import brandTokens from '../../../../assets/brand/tokens.json';

export const tokens = {
  ...brandTokens,
  fonts: {
    body: 'NotoSansRegular',
    label: 'NotoSansSemiBold',
    title: 'ManropeBold',
  },
} as const;
