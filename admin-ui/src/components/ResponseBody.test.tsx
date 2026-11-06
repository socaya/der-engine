import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResponseBody } from './ResponseBody';

describe('ResponseBody', () => {
  it('renders em-dash for null / empty', () => {
    const { rerender } = render(<ResponseBody text={null} dataTest="empty" />);
    expect(screen.getByTestId('empty')).toHaveTextContent('—');
    rerender(<ResponseBody text="" dataTest="empty" />);
    expect(screen.getByTestId('empty')).toHaveTextContent('—');
    rerender(<ResponseBody text={undefined} dataTest="empty" />);
    expect(screen.getByTestId('empty')).toHaveTextContent('—');
  });

  it('pretty-prints JSON objects', () => {
    render(<ResponseBody text='{"httpStatus":"OK","response":{"importCount":{"imported":0}}}'
                         dataTest="json" />);
    const text = screen.getByTestId('json').textContent ?? '';
    expect(text).toContain('"httpStatus": "OK"');
    expect(text).toContain('"importCount": {');
    expect(text).toContain('"imported": 0');
  });

  it('pretty-prints JSON arrays', () => {
    render(<ResponseBody text='[{"a":1},{"a":2}]' dataTest="arr" />);
    const text = screen.getByTestId('arr').textContent ?? '';
    expect(text).toContain('"a": 1');
    expect(text).toContain('"a": 2');
  });

  it('leaves non-JSON strings untouched', () => {
    render(<ResponseBody text="HTTP 500: backend exploded" dataTest="plain" />);
    expect(screen.getByTestId('plain')).toHaveTextContent('HTTP 500: backend exploded');
  });

  it('leaves invalid JSON-looking strings untouched', () => {
    render(<ResponseBody text='{broken' dataTest="broken" />);
    expect(screen.getByTestId('broken')).toHaveTextContent('{broken');
  });
});
