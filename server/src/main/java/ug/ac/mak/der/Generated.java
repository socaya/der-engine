package ug.ac.mak.der;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marker annotation used to exclude a method or class from coverage checks.
 *
 * <p>JaCoCo recognises any annotation whose simple name contains {@code Generated};
 * applying this annotation signals a documented reviewer-approved exclusion for
 * code that is either (a) a JRE-spec defensive branch that cannot be reached in
 * practice, or (b) framework boot plumbing exercised only by integration tests.</p>
 *
 * <p>DER-ENG-001 §5 point 3 explicitly permits such exclusions provided they are
 * documented. Each use MUST carry an inline rationale.</p>
 */
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.METHOD, ElementType.TYPE, ElementType.CONSTRUCTOR})
public @interface Generated {
    String value() default "";
}
