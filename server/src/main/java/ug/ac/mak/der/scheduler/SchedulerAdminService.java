package ug.ac.mak.der.scheduler;

import java.text.ParseException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Objects;

import org.quartz.CronExpression;
import org.quartz.CronScheduleBuilder;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.Trigger;
import org.quartz.TriggerBuilder;
import org.quartz.TriggerKey;
import org.quartz.TriggerUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * SM-3b — hot-reload Quartz cron schedules + preview the next N fire
 * times. Called by {@link
 * ug.ac.mak.der.web.AdminSettingsController} after it persists the
 * new cron string so operators don't need a restart for a schedule
 * change to take effect.
 */
@Service
public class SchedulerAdminService {

    private static final Logger LOG = LoggerFactory.getLogger(
            SchedulerAdminService.class);

    private final Scheduler scheduler;

    public SchedulerAdminService(final Scheduler scheduler) {
        this.scheduler = Objects.requireNonNull(scheduler, "scheduler");
    }

    /** Validate + reschedule the Quartz trigger for {@code jobName}.
     *
     *  @param jobName the Quartz job identity (eg {@code
     *                 "JOURNAL_WORKER_DRAIN"}).
     *  @param cron    a cron expression in Quartz's 6/7-field dialect.
     *  @return the next 3 fire times (ISO instants) under the new cron.
     *  @throws IllegalArgumentException if the cron is syntactically
     *          invalid or the trigger doesn't exist. */
    public List<Instant> reschedule(final String jobName, final String cron) {
        Objects.requireNonNull(jobName, "jobName");
        Objects.requireNonNull(cron, "cron");
        try {
            new CronExpression(cron);
        } catch (ParseException ex) {
            throw new IllegalArgumentException(
                    "Invalid cron: " + ex.getMessage(), ex);
        }
        final TriggerKey key = TriggerKey.triggerKey(jobName + "_TRIGGER");
        try {
            final Trigger existing = scheduler.getTrigger(key);
            if (existing == null) {
                throw new IllegalArgumentException(
                        "No scheduled job named " + jobName);
            }
            final Trigger rebuilt = TriggerBuilder.newTrigger()
                    .forJob(existing.getJobKey())
                    .withIdentity(key)
                    .withSchedule(CronScheduleBuilder.cronSchedule(cron))
                    .build();
            scheduler.rescheduleJob(key, rebuilt);
            LOG.info("rescheduled {} -> cron '{}'", jobName, cron);
            return previewFromTrigger(rebuilt);
        } catch (SchedulerException ex) {
            throw new IllegalStateException(
                    "Failed to reschedule " + jobName + ": "
                  + ex.getMessage(), ex);
        }
    }

    /** Compute the next N fire times for an arbitrary cron
     *  expression — no side effects on the scheduler. Lets the admin
     *  UI preview "Try this cron" before committing. */
    public List<Instant> preview(final String cron, final int howMany) {
        Objects.requireNonNull(cron, "cron");
        try {
            new CronExpression(cron);
        } catch (ParseException ex) {
            throw new IllegalArgumentException(
                    "Invalid cron: " + ex.getMessage(), ex);
        }
        final Trigger tmp = TriggerBuilder.newTrigger()
                .withSchedule(CronScheduleBuilder.cronSchedule(cron))
                .startAt(new Date())
                .build();
        return previewFromTrigger(tmp, Math.max(1, Math.min(10, howMany)));
    }

    private static List<Instant> previewFromTrigger(final Trigger t) {
        return previewFromTrigger(t, 3);
    }

    private static List<Instant> previewFromTrigger(final Trigger t,
                                                     final int howMany) {
        final List<Date> next = TriggerUtils.computeFireTimes(
                (org.quartz.spi.OperableTrigger) t, null, howMany);
        final List<Instant> out = new ArrayList<>(next.size());
        for (Date d : next) {
            out.add(d.toInstant());
        }
        return out;
    }
}
