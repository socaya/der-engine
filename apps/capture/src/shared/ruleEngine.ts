import type {
  CaptureField, CaptureFormSection, CaptureParseIssue,
  CaptureProgramRule, CaptureProgramRuleVariable, CaptureRuleAction,
} from './model';

/**
 * Program-rule evaluator for the unified Capture app
 * (requirements doc §11 PR-002/PR-003, §7.4 Rules engine
 * acceptance matrix).
 *
 * <p>Design goals</p>
 *   • Deterministic: pure function of (rules, variables, values).
 *   • Safe: rules with unsupported expressions are skipped and
 *     surface an issue; they never silently misapply (§PR-004,
 *     §PR-008).
 *   • Narrow: start with the actions most DHIS2 programs
 *     actually ship with — HIDEFIELD, HIDESECTION,
 *     SETMANDATORYFIELD, SHOWWARNING, SHOWERROR. Richer actions
 *     (ASSIGN, HIDEOPTION, …) are flagged as "unsupported in
 *     G3-2" so operators see what still needs an admin resolve.
 *
 * <p>Expression grammar (subset of the DHIS2 rule language):</p>
 * <pre>
 *   expr    := or
 *   or      := and ('||' and)*
 *   and     := not ('&&' not)*
 *   not     := '!' not | cmp
 *   cmp     := unary (('==' | '!=' | '<' | '<=' | '>' | '>=') unary)?
 *   unary   := '-' unary | primary
 *   primary := number | string | bool | var | fn | '(' expr ')'
 *   var     := '#{' ident '}'
 *   fn      := 'd2:hasValue' '(' var ')'
 * </pre>
 */

export interface RuleWarning {
  readonly ruleId: string;
  readonly severity: 'warning' | 'error';
  readonly message: string;
  readonly fieldId: string | null;
}

export interface RuleEffectSet {
  readonly hiddenFieldIds: ReadonlySet<string>;
  readonly hiddenSectionIds: ReadonlySet<string>;
  readonly mandatoryFieldIds: ReadonlySet<string>;
  readonly warnings: readonly RuleWarning[];
  readonly issues: readonly CaptureParseIssue[];
}

const EMPTY_EFFECTS: RuleEffectSet = {
  hiddenFieldIds: new Set(),
  hiddenSectionIds: new Set(),
  mandatoryFieldIds: new Set(),
  warnings: [],
  issues: [],
};

export function evaluateRules(
  rules: readonly CaptureProgramRule[],
  variables: readonly CaptureProgramRuleVariable[],
  values: Readonly<Record<string, string>>,
): RuleEffectSet {
  if (rules.length === 0) return EMPTY_EFFECTS;

  const hiddenFieldIds = new Set<string>();
  const hiddenSectionIds = new Set<string>();
  const mandatoryFieldIds = new Set<string>();
  const warnings: RuleWarning[] = [];
  const issues: CaptureParseIssue[] = [];

  // Variable name → current value lookup. For event programs the
  // variable's dataElementId maps to a key in `values`; for tracker
  // fields it'll map to a TEA UID. G3-2 only honours
  // DATAELEMENT_CURRENT_EVENT — the common case — and surfaces
  // an issue for everything else so an operator can see which
  // rules are not being executed (§PR-004).
  const varLookup = new Map<string, { value: string; hasValue: boolean }>();
  for (const v of variables) {
    if (v.source !== 'DATAELEMENT_CURRENT_EVENT' || !v.dataElementId) {
      // Non-event sources are reported once per batch below, not
      // per rule, to avoid flooding the issue list.
      continue;
    }
    const raw = values[v.dataElementId] ?? '';
    varLookup.set(v.name, { value: raw, hasValue: raw.trim() !== '' });
  }
  for (const v of variables) {
    if (v.source !== 'DATAELEMENT_CURRENT_EVENT') {
      issues.push({ severity: 'warning', code: 'RULE_VAR_SOURCE_UNSUPPORTED',
        message: `Variable "${v.name}" (${v.source}) is not evaluated `
          + 'by the G3-2 engine; rules depending on it will not fire',
        path: 'programRuleVariables[' + v.id + ']' });
    }
  }

  for (const rule of rules) {
    if (rule.condition.trim() === '') continue;
    const result = evaluateExpression(rule.condition, varLookup);
    if (result.kind === 'error') {
      issues.push({ severity: 'warning', code: 'RULE_EXPR_UNSUPPORTED',
        message: `Rule "${rule.name}" (${rule.id}) uses an expression `
          + 'the G3-2 engine cannot evaluate: ' + result.reason,
        path: 'programRules[' + rule.id + '].condition' });
      continue;
    }
    if (!result.value) continue;
    for (const action of rule.actions) applyAction(action, rule,
      hiddenFieldIds, hiddenSectionIds, mandatoryFieldIds, warnings,
      issues, varLookup);
  }

  return { hiddenFieldIds, hiddenSectionIds, mandatoryFieldIds,
    warnings, issues };
}

function applyAction(
  action: CaptureRuleAction,
  rule: CaptureProgramRule,
  hiddenFieldIds: Set<string>,
  hiddenSectionIds: Set<string>,
  mandatoryFieldIds: Set<string>,
  warnings: RuleWarning[],
  issues: CaptureParseIssue[],
  varLookup: ReadonlyMap<string, { value: string; hasValue: boolean }>,
): void {
  switch (action.type) {
    case 'HIDEFIELD': {
      const target = action.dataElementId ?? action.trackedEntityAttributeId;
      if (target) hiddenFieldIds.add(target);
      return;
    }
    case 'HIDESECTION': {
      if (action.programStageSectionId) {
        hiddenSectionIds.add(action.programStageSectionId);
      }
      return;
    }
    case 'SETMANDATORYFIELD': {
      const target = action.dataElementId ?? action.trackedEntityAttributeId;
      if (target) mandatoryFieldIds.add(target);
      return;
    }
    case 'SHOWWARNING':
    case 'WARNINGONCOMPLETE':
    case 'SHOWERROR':
    case 'ERRORONCOMPLETE': {
      const severity: 'warning' | 'error' =
        action.type === 'SHOWERROR' || action.type === 'ERRORONCOMPLETE'
          ? 'error' : 'warning';
      const extra = action.data
        ? ' (' + describeData(action.data, varLookup) + ')'
        : '';
      warnings.push({
        ruleId: rule.id,
        severity,
        message: (action.content ?? rule.name) + extra,
        fieldId: action.dataElementId
          ?? action.trackedEntityAttributeId
          ?? null,
      });
      return;
    }
    case 'HIDEPROGRAMSTAGE':
    case 'ASSIGN':
    case 'HIDEOPTION':
    case 'HIDEOPTIONGROUP':
    case 'SHOWOPTIONGROUP':
    case 'UNKNOWN':
    default:
      issues.push({ severity: 'warning', code: 'RULE_ACTION_NOT_APPLIED',
        message: `Action ${action.type} on rule "${rule.name}" is not `
          + 'applied by the G3-2 engine (queued for later gates)',
        path: 'programRules[' + rule.id + '].actions[' + action.id + ']' });
  }
}

/** Evaluate the {@code data} payload of a warning/error action and
 *  render it for display. Falls back to the raw text if the data
 *  expression can't be evaluated — the warning is still useful. */
function describeData(
  data: string,
  varLookup: ReadonlyMap<string, { value: string; hasValue: boolean }>,
): string {
  const r = evaluateExpression(data, varLookup);
  if (r.kind === 'ok') return typeof r.value === 'string'
    ? r.value : String(r.value);
  return data;
}

/* ─── Expression evaluator ─────────────────────────────────── */

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'str'; value: string }
  | { kind: 'bool'; value: boolean }
  | { kind: 'var'; value: string }
  | { kind: 'fn'; value: string }
  | { kind: 'op'; value: string };

interface EvalOk { kind: 'ok'; value: number | string | boolean }
interface EvalErr { kind: 'error'; reason: string }
type EvalResult = EvalOk | EvalErr;

export function evaluateExpression(
  expr: string,
  variables: ReadonlyMap<string, { value: string; hasValue: boolean }>,
): EvalResult {
  let tokens: readonly Token[];
  try {
    tokens = tokenize(expr);
  } catch (err) {
    return { kind: 'error', reason: (err as Error).message };
  }
  const parser = { pos: 0, tokens };
  let value: EvalResult;
  try {
    value = parseOr(parser, variables);
  } catch (err) {
    return { kind: 'error', reason: (err as Error).message };
  }
  if (parser.pos !== tokens.length) {
    return { kind: 'error',
      reason: 'trailing tokens after expression' };
  }
  return value;
}

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const c = expr[i]!;
    if (/\s/.test(c)) { i++; continue; }
    if (c === '(' || c === ')') {
      tokens.push({ kind: 'op', value: c }); i++; continue;
    }
    if (c === '!' || c === '=' || c === '<' || c === '>'
        || c === '&' || c === '|') {
      const two = expr.slice(i, i + 2);
      if (['==', '!=', '<=', '>=', '&&', '||'].includes(two)) {
        tokens.push({ kind: 'op', value: two }); i += 2; continue;
      }
      if (c === '!' || c === '<' || c === '>') {
        tokens.push({ kind: 'op', value: c }); i++; continue;
      }
      throw new Error('unexpected character: ' + c);
    }
    if (c === '-' || c === '+') {
      tokens.push({ kind: 'op', value: c }); i++; continue;
    }
    if (c === "'" || c === '"') {
      const quote = c; let j = i + 1;
      while (j < expr.length && expr[j] !== quote) j++;
      if (j === expr.length) throw new Error('unterminated string');
      tokens.push({ kind: 'str', value: expr.slice(i + 1, j) });
      i = j + 1; continue;
    }
    if (/\d/.test(c)) {
      let j = i;
      while (j < expr.length && /[\d.]/.test(expr[j]!)) j++;
      const n = Number(expr.slice(i, j));
      if (!Number.isFinite(n)) throw new Error('bad number');
      tokens.push({ kind: 'num', value: n });
      i = j; continue;
    }
    if (c === '#' && expr[i + 1] === '{') {
      let j = i + 2;
      while (j < expr.length && expr[j] !== '}') j++;
      if (j === expr.length) throw new Error('unterminated #{...}');
      tokens.push({ kind: 'var', value: expr.slice(i + 2, j) });
      i = j + 1; continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i;
      while (j < expr.length && /[a-zA-Z0-9_:]/.test(expr[j]!)) j++;
      const ident = expr.slice(i, j);
      if (ident === 'true' || ident === 'false') {
        tokens.push({ kind: 'bool', value: ident === 'true' });
      } else if (ident.includes(':')) {
        tokens.push({ kind: 'fn', value: ident });
      } else {
        throw new Error('unknown identifier: ' + ident);
      }
      i = j; continue;
    }
    throw new Error('unexpected character: ' + c);
  }
  return tokens;
}

interface Parser { pos: number; tokens: readonly Token[] }

function peek(p: Parser): Token | null {
  return p.tokens[p.pos] ?? null;
}
function consume(p: Parser): Token {
  const t = p.tokens[p.pos];
  if (!t) throw new Error('unexpected end of expression');
  p.pos++;
  return t;
}

function parseOr(p: Parser, vars:
    ReadonlyMap<string, { value: string; hasValue: boolean }>): EvalResult {
  let left = parseAnd(p, vars);
  while (left.kind === 'ok' && peek(p)?.value === '||') {
    consume(p);
    const right = parseAnd(p, vars);
    if (right.kind === 'error') return right;
    left = { kind: 'ok', value: toBool(left.value) || toBool(right.value) };
  }
  return left;
}

function parseAnd(p: Parser, vars:
    ReadonlyMap<string, { value: string; hasValue: boolean }>): EvalResult {
  let left = parseNot(p, vars);
  while (left.kind === 'ok' && peek(p)?.value === '&&') {
    consume(p);
    const right = parseNot(p, vars);
    if (right.kind === 'error') return right;
    left = { kind: 'ok', value: toBool(left.value) && toBool(right.value) };
  }
  return left;
}

function parseNot(p: Parser, vars:
    ReadonlyMap<string, { value: string; hasValue: boolean }>): EvalResult {
  if (peek(p)?.value === '!') {
    consume(p);
    const r = parseNot(p, vars);
    if (r.kind === 'error') return r;
    return { kind: 'ok', value: !toBool(r.value) };
  }
  return parseCmp(p, vars);
}

function parseCmp(p: Parser, vars:
    ReadonlyMap<string, { value: string; hasValue: boolean }>): EvalResult {
  const left = parseUnary(p, vars);
  if (left.kind === 'error') return left;
  const op = peek(p);
  if (op && (op.value === '==' || op.value === '!='
      || op.value === '<' || op.value === '<='
      || op.value === '>' || op.value === '>=')) {
    consume(p);
    const right = parseUnary(p, vars);
    if (right.kind === 'error') return right;
    return compare(op.value, left.value, right.value);
  }
  return left;
}

function parseUnary(p: Parser, vars:
    ReadonlyMap<string, { value: string; hasValue: boolean }>): EvalResult {
  if (peek(p)?.value === '-') {
    consume(p);
    const r = parsePrimary(p, vars);
    if (r.kind === 'error') return r;
    const n = toNum(r.value);
    if (n === null) return { kind: 'error',
      reason: 'cannot negate non-numeric value' };
    return { kind: 'ok', value: -n };
  }
  return parsePrimary(p, vars);
}

function parsePrimary(p: Parser, vars:
    ReadonlyMap<string, { value: string; hasValue: boolean }>): EvalResult {
  const t = consume(p);
  if (t.kind === 'num') return { kind: 'ok', value: t.value };
  if (t.kind === 'str') return { kind: 'ok', value: t.value };
  if (t.kind === 'bool') return { kind: 'ok', value: t.value };
  if (t.kind === 'var') {
    const v = vars.get(t.value);
    if (!v) return { kind: 'error',
      reason: 'unknown variable #{' + t.value + '}' };
    return { kind: 'ok', value: v.value };
  }
  if (t.kind === 'fn') {
    return evalFunction(t.value, p, vars);
  }
  if (t.value === '(') {
    const inner = parseOr(p, vars);
    if (inner.kind === 'error') return inner;
    const close = consume(p);
    if (close.value !== ')') return { kind: 'error',
      reason: 'missing )' };
    return inner;
  }
  return { kind: 'error',
    reason: 'unexpected token: ' + JSON.stringify(t) };
}

function evalFunction(
  name: string, p: Parser,
  vars: ReadonlyMap<string, { value: string; hasValue: boolean }>,
): EvalResult {
  if (name !== 'd2:hasValue') {
    return { kind: 'error', reason: 'unsupported function: ' + name };
  }
  const open = consume(p);
  if (open.value !== '(') return { kind: 'error',
    reason: 'expected ( after ' + name };
  const varTok = consume(p);
  if (varTok.kind !== 'var') return { kind: 'error',
    reason: 'd2:hasValue expects a #{var} argument' };
  const close = consume(p);
  if (close.value !== ')') return { kind: 'error',
    reason: 'missing ) for d2:hasValue' };
  const v = vars.get(varTok.value);
  return { kind: 'ok', value: v?.hasValue ?? false };
}

function compare(op: string, a: EvalOk['value'], b: EvalOk['value']):
    EvalResult {
  // If either side is a number OR both parse as numbers, coerce.
  const na = toNum(a); const nb = toNum(b);
  const bothNum = na !== null && nb !== null;
  const l: number | string | boolean = bothNum ? na! : a;
  const r: number | string | boolean = bothNum ? nb! : b;
  switch (op) {
    case '==': return { kind: 'ok', value: l === r };
    case '!=': return { kind: 'ok', value: l !== r };
    case '<':  return { kind: 'ok', value: (l as number) < (r as number) };
    case '<=': return { kind: 'ok', value: (l as number) <= (r as number) };
    case '>':  return { kind: 'ok', value: (l as number) > (r as number) };
    case '>=': return { kind: 'ok', value: (l as number) >= (r as number) };
    default:   return { kind: 'error', reason: 'unknown operator ' + op };
  }
}

function toBool(v: number | string | boolean): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  return v.trim() !== '' && v !== 'false' && v !== '0';
}

function toNum(v: number | string | boolean): number | null {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* ─── Effect application ───────────────────────────────────── */

/** Strip hidden fields / hidden sections from the parsed form and
 *  promote mandatory flags per the effect set. Returns a brand
 *  new sections array so the React form never mutates in place
 *  (§FR-009 — preserve focus, scroll position + values on rule
 *  changes). */
export function applyRuleEffectsToSections(
  sections: readonly CaptureFormSection[],
  effects: RuleEffectSet,
): readonly CaptureFormSection[] {
  const { hiddenFieldIds, hiddenSectionIds, mandatoryFieldIds } = effects;
  if (hiddenFieldIds.size === 0 && hiddenSectionIds.size === 0
      && mandatoryFieldIds.size === 0) {
    return sections;
  }
  const out: CaptureFormSection[] = [];
  for (const s of sections) {
    if (s.id && hiddenSectionIds.has(s.id)) continue;
    const fields: CaptureField[] = [];
    for (const f of s.fields) {
      if (hiddenFieldIds.has(f.id)) continue;
      const mandatoryOverride = mandatoryFieldIds.has(f.id);
      if (mandatoryOverride && !f.required) {
        fields.push({ ...f, required: true });
      } else {
        fields.push(f);
      }
    }
    out.push({ ...s, fields });
  }
  return out;
}
