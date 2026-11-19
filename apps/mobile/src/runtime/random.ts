/** Base64url sans Buffer Node ; les 256 bits viennent exclusivement d'Expo Crypto. */
export function encodeRegistrationToken(bytes: Uint8Array): string {
  if (bytes.length !== 32) throw new Error('RANDOM_UNAVAILABLE');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let bits = 0,
    value = 0,
    output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      output += alphabet[(value >>> bits) & 63];
    }
    value &= (1 << bits) - 1;
  }
  if (bits) output += alphabet[(value << (6 - bits)) & 63];
  return output;
}
