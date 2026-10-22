package ug.ac.mak.der.scheduler;

import org.quartz.CronScheduleBuilder;
import org.quartz.JobBuilder;
import org.quartz.JobDetail;
import org.quartz.Trigger;
import org.quartz.TriggerBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Spring config that wires three durable Quartz jobs. Quartz's Postgres JobStore
 * stores them persistently so the schedule survives restarts. ADR-0008.
 *
 * <p>Disabled when {@code der.sync.enabled=false} (useful for @WebMvcTest).</p>
 */
@Configuration
@ConditionalOnProperty(prefix = "der.sync", name = "enabled", havingValue = "true", matchIfMissing = true)
public class SchedulerConfig {

    @Bean
    public JobDetail metadataSyncJobDetail() {
        return JobBuilder.newJob(MetadataSyncJob.class)
                .withIdentity(MetadataSyncJob.JOB_NAME)
                .storeDurably()
                .requestRecovery()
                .build();
    }

    @Bean
    public Trigger metadataSyncTrigger(final JobDetail metadataSyncJobDetail,
                                        @Value("${der.sync.metadata.cron:0 0 */4 * * ?}")
                                        final String cron) {
        return TriggerBuilder.newTrigger()
                .forJob(metadataSyncJobDetail)
                .withIdentity(MetadataSyncJob.JOB_NAME + "_TRIGGER")
                .withSchedule(CronScheduleBuilder.cronSchedule(cron))
                .build();
    }

    @Bean
    public JobDetail compatRefreshJobDetail() {
        return JobBuilder.newJob(CompatRefreshJob.class)
                .withIdentity(CompatRefreshJob.JOB_NAME)
                .storeDurably()
                .requestRecovery()
                .build();
    }

    @Bean
    public Trigger compatRefreshTrigger(final JobDetail compatRefreshJobDetail,
                                         @Value("${der.sync.compat.cron:0 0 3 * * ?}")
                                         final String cron) {
        return TriggerBuilder.newTrigger()
                .forJob(compatRefreshJobDetail)
                .withIdentity(CompatRefreshJob.JOB_NAME + "_TRIGGER")
                .withSchedule(CronScheduleBuilder.cronSchedule(cron))
                .build();
    }

    @Bean
    public JobDetail driftSnapshotJobDetail() {
        return JobBuilder.newJob(DriftSnapshotJob.class)
                .withIdentity(DriftSnapshotJob.JOB_NAME)
                .storeDurably()
                .requestRecovery()
                .build();
    }

    @Bean
    public Trigger driftSnapshotTrigger(final JobDetail driftSnapshotJobDetail,
                                         @Value("${der.sync.drift.cron:0 10 */4 * * ?}")
                                         final String cron) {
        return TriggerBuilder.newTrigger()
                .forJob(driftSnapshotJobDetail)
                .withIdentity(DriftSnapshotJob.JOB_NAME + "_TRIGGER")
                .withSchedule(CronScheduleBuilder.cronSchedule(cron))
                .build();
    }

    @Bean
    public JobDetail journalDrainJobDetail() {
        return JobBuilder.newJob(JournalDrainJob.class)
                .withIdentity(JournalDrainJob.JOB_NAME)
                .storeDurably()
                .requestRecovery()
                .build();
    }

    @Bean
    public Trigger journalDrainTrigger(final JobDetail journalDrainJobDetail,
                                         @Value("${der.journal.drain.cron:0 * * * * ?}")
                                         final String cron) {
        return TriggerBuilder.newTrigger()
                .forJob(journalDrainJobDetail)
                .withIdentity(JournalDrainJob.JOB_NAME + "_TRIGGER")
                .withSchedule(CronScheduleBuilder.cronSchedule(cron))
                .build();
    }

    @Bean
    public JobDetail backupDrainJobDetail() {
        return JobBuilder.newJob(BackupDrainJob.class)
                .withIdentity(BackupDrainJob.JOB_NAME)
                .storeDurably()
                .requestRecovery()
                .build();
    }

    @Bean
    public Trigger backupDrainTrigger(final JobDetail backupDrainJobDetail,
                                       @Value("${der.backup.drain.cron:0 */15 * * * ?}")
                                       final String cron) {
        return TriggerBuilder.newTrigger()
                .forJob(backupDrainJobDetail)
                .withIdentity(BackupDrainJob.JOB_NAME + "_TRIGGER")
                .withSchedule(CronScheduleBuilder.cronSchedule(cron))
                .build();
    }

    @Bean
    public JobDetail analyticsRefreshJobDetail() {
        return JobBuilder.newJob(AnalyticsRefreshJob.class)
                .withIdentity(AnalyticsRefreshJob.JOB_NAME)
                .storeDurably()
                .requestRecovery()
                .build();
    }

    @Bean
    public Trigger analyticsRefreshTrigger(final JobDetail analyticsRefreshJobDetail,
                                            @Value("${der.analytics.refresh.cron:0 */5 * * * ?}")
                                            final String cron) {
        return TriggerBuilder.newTrigger()
                .forJob(analyticsRefreshJobDetail)
                .withIdentity(AnalyticsRefreshJob.JOB_NAME + "_TRIGGER")
                .withSchedule(CronScheduleBuilder.cronSchedule(cron))
                .build();
    }
}
