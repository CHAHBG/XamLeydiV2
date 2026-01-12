export function canonicalizeProperties(properties: Record<string, any> | null | undefined) {
  if (!properties) return properties;
  const props: Record<string, any> = { ...properties };

  // Canonicalize vocation-like keys
  if (!props.Vocation) {
    for (const [k, v] of Object.entries(properties)) {
      if (!k || typeof k !== 'string') continue;
      const kl = k.toLowerCase().replace(/_/g, '');
      if (kl.startsWith('vocation') && v) {
        props.Vocation = v;
        break;
      }
    }
  }

  // Canonicalize type usage keys -> 'type_usag'
  if (!props.type_usag) {
    for (const [k, v] of Object.entries(properties)) {
      if (!k || typeof k !== 'string') continue;
      const kl = k.toLowerCase().replace(/[_\s]/g, '');
      if (
        (kl === 'typeusa' ||
          kl === 'typeusage' ||
          kl === 'typeusag' ||
          kl === 'typeusag1' ||
          kl === 'typeusa1' ||
          kl === 'usage') &&
        v
      ) {
        props.type_usag = v;
        break;
      }
    }
  }

  // Canonicalize village-like keys -> 'Village'
  if (!props.Village) {
    for (const [k, v] of Object.entries(properties)) {
      if (!k || typeof k !== 'string' || !v) continue;
      const kl = k.toLowerCase().trim();
      if (kl.includes('village') || kl.startsWith('village') || kl.includes('commune') || kl.includes('localit') || kl.includes('locality')) {
        props.Village = v;
        break;
      }
    }
  }

  return props;
}
