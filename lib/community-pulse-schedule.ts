const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';

export const COMMUNITY_PULSE_REFRESH_HOURS = [0, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23] as const;

type LocalDateTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const saoPauloFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SAO_PAULO_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function partsInSaoPaulo(date: Date): LocalDateTime {
  const values = Object.fromEntries(
    saoPauloFormatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function addLocalDays(date: Pick<LocalDateTime, 'year' | 'month' | 'day'>, days: number) {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function localDateTimeToInstant(local: LocalDateTime): Date {
  const targetAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
  let instant = targetAsUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const rendered = partsInSaoPaulo(new Date(instant));
    const renderedAsUtc = Date.UTC(
      rendered.year,
      rendered.month - 1,
      rendered.day,
      rendered.hour,
      rendered.minute,
      rendered.second
    );
    const adjustment = targetAsUtc - renderedAsUtc;
    if (adjustment === 0) break;
    instant += adjustment;
  }

  return new Date(instant);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function getCommunityPulseSchedule(now = new Date()) {
  const localNow = partsInSaoPaulo(now);
  const currentHour = [...COMMUNITY_PULSE_REFRESH_HOURS]
    .reverse()
    .find((hour) => hour <= localNow.hour) ?? 0;
  const currentIndex = COMMUNITY_PULSE_REFRESH_HOURS.indexOf(currentHour);
  const rollsToNextDay = currentIndex === COMMUNITY_PULSE_REFRESH_HOURS.length - 1;
  const nextHour = rollsToNextDay ? 0 : COMMUNITY_PULSE_REFRESH_HOURS[currentIndex + 1];
  const nextDate = addLocalDays(localNow, rollsToNextDay ? 1 : 0);

  const snapshotAt = localDateTimeToInstant({
    year: localNow.year,
    month: localNow.month,
    day: localNow.day,
    hour: currentHour,
    minute: 0,
    second: 0,
  });
  const nextRefreshAt = localDateTimeToInstant({
    ...nextDate,
    hour: nextHour,
    minute: 0,
    second: 0,
  });

  return {
    cacheKey: `${localNow.year}-${pad(localNow.month)}-${pad(localNow.day)}T${pad(currentHour)}`,
    snapshotAt,
    nextRefreshAt,
    secondsUntilNextRefresh: Math.max(1, Math.ceil((nextRefreshAt.getTime() - now.getTime()) / 1_000)),
  };
}
