import LuxonUtils from '@date-io/luxon';
import DayJsUtils from '@date-io/dayjs';
import MomentUtils from '@date-io/moment';
import DateFnsUtils from '@date-io/date-fns';

export const utilsMap = {
  moment: MomentUtils,
  luxon: LuxonUtils,
  dayjs: DayJsUtils,
  'date-fns': DateFnsUtils,
};

export type UtilsLib = keyof typeof utilsMap;
export type FormatsMap = Record<UtilsLib, string>;

function cascadeFormats(lib: UtilsLib, formatsMap: FormatsMap) {
  switch (lib) {
    case 'date-fns':
      return formatsMap['date-fns'];
    case 'luxon':
      return formatsMap.luxon || formatsMap['date-fns'];
    case 'moment':
      return formatsMap.moment;
    case 'dayjs':
      return formatsMap.dayjs || formatsMap.moment;
    default:
      return formatsMap['date-fns'];
  }
}

export const createUtilsService = (lib: UtilsLib) => ({
  lib,
  __willBeReplacedGetFormatString: (formats: FormatsMap) => cascadeFormats(lib, formats),
});

export type UtilsService = ReturnType<typeof createUtilsService>;

const libRegex = /(moment|luxon|date-fns|datefns|dayjs)/i;
const endInvocationPattern = '})}';
const startInvocationPattern = '{props.__willBeReplacedGetFormatString({';

function replaceGetFormatInvocation(sourceToProcess: string, lib: UtilsLib) {
  const startOfExpression = sourceToProcess.indexOf(startInvocationPattern);
  const endOfExpression = sourceToProcess.indexOf(endInvocationPattern, startOfExpression);

  const getFormatStringInvocation = sourceToProcess.slice(
    startOfExpression,
    endOfExpression + endInvocationPattern.length
  );

  const formatsMap = getFormatStringInvocation
    .split('\n')
    .filter(str => libRegex.test(str))
    .map(formatLine => {
      const libMatchResult = formatLine.match(libRegex);
      if (!libMatchResult) {
        return [];
      }

      const lib = libMatchResult[0];
      const libFormat = formatLine
        .replace(lib, '')
        .replace(':', '') // replace only the first occurrence
        .replace(/("|'|,)/g, '')
        .trim();

      // allow both date-fns and dateFns
      return [lib.replace('dateFns', 'date-fns'), libFormat] as [UtilsLib, string];
    })
    .reduce<FormatsMap>(
      (obj, [key, value]) => {
        obj[key] = value;
        return obj;
      },
      {} as any
    );

  const currentLibFormat = cascadeFormats(lib, formatsMap);
  return sourceToProcess.replace(getFormatStringInvocation, `"${currentLibFormat}"`);
}

export function replaceGetFormatStrings(lib: UtilsLib, sourceToProcess: string): string {
  let processedSource = sourceToProcess;
  while (processedSource.includes(startInvocationPattern)) {
    processedSource = replaceGetFormatInvocation(processedSource, lib);
  }

  return processedSource;
}
