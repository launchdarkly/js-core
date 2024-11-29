/* eslint-disable no-bitwise */
import { fallbackUuidV4, formatDataAsUuidV4 } from '../src/randomUuidV4';

it('formats conformant UUID', () => {
  // For this test we remove the random component and just inspect the variant and version.
  const idA = formatDataAsUuidV4(Array(16).fill(0x00));
  const idB = formatDataAsUuidV4(Array(16).fill(0xff));
  const idC = fallbackUuidV4();

  // 32 characters and 4 dashes
  expect(idC).toHaveLength(36);
  const versionA = idA[14];
  const versionB = idB[14];
  const versionC = idB[14];

  expect(versionA).toEqual('4');
  expect(versionB).toEqual('4');
  expect(versionC).toEqual('4');

  // Keep only the top 2 bits.
  const specifierA = parseInt(idA[19], 16) & 0xc;
  const specifierB = parseInt(idB[19], 16) & 0xc;
  const specifierC = parseInt(idC[19], 16) & 0xc;

  // bit 6 should be 0 and bit 8 should be one, which is 0x8
  expect(specifierA).toEqual(0x8);
  expect(specifierB).toEqual(0x8);
  expect(specifierC).toEqual(0x8);
});
