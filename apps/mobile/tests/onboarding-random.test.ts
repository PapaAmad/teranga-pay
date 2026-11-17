import { createOnboardingRandom } from '../src/onboarding/random';

const mockFill = jest.fn((sample: Uint32Array) => {
  sample[0] = 0;
  return sample;
});
jest.mock('expo-crypto', () => ({
  getRandomValues: (sample: Uint32Array) => mockFill(sample),
}));

describe('onboarding | aléa du quiz', () => {
  beforeEach(() => mockFill.mockClear());

  it('rejette les valeurs du modulo biaisé puis utilise le nouvel échantillon', () => {
    mockFill.mockImplementationOnce((sample) => {
      sample[0] = 0xffff_ffff;
      return sample;
    });
    mockFill.mockImplementationOnce((sample) => {
      sample[0] = 5;
      return sample;
    });
    expect(createOnboardingRandom().integer(3)).toBe(2);
    expect(mockFill).toHaveBeenCalledTimes(2);
  });

  it.each([0, -1, 0.5, Number.NaN, 0x1_0000_0001])(
    'refuse une plage incorrecte %s avant de solliciter le natif',
    (range) => {
      expect(() => createOnboardingRandom().integer(range)).toThrow('ONBOARDING_RANDOM_RANGE');
      expect(mockFill).not.toHaveBeenCalled();
    },
  );

  it('refuse une source qui ne remplit pas le tableau demandé', () => {
    mockFill.mockImplementationOnce(() => new Uint32Array(1));
    expect(() => createOnboardingRandom().integer(3)).toThrow('ONBOARDING_RANDOM_UNAVAILABLE');
  });

  it('borne les rejets sans remplacer une source défaillante par Math.random', () => {
    mockFill.mockImplementation((sample) => {
      sample[0] = 0xffff_ffff;
      return sample;
    });
    expect(() => createOnboardingRandom().integer(3)).toThrow('ONBOARDING_RANDOM_UNAVAILABLE');
    expect(mockFill).toHaveBeenCalledTimes(128);
    mockFill.mockImplementation((sample) => {
      sample[0] = 0;
      return sample;
    });
  });
});
