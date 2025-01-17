function contextToString(
  obj: { [key: string]: unknown },
  mode?: string,
): string | null {
  return obj
    ? Object.keys(obj)
        .map((key) => {
          switch (mode) {
            case 'keyHash':
              return `${key}-${obj[key]}`;
            default:
              return `${key}="${obj[key]}"`;
          }
        })
        .join(mode === 'keyHash' ? '' : ', ')
    : null;
}

export default contextToString;
