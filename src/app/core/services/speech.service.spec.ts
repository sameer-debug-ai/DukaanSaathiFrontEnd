import { joinCumulative } from './speech.service';

describe('joinCumulative', () => {
  it('keeps only the latest phrase when Android repeats the whole sentence', () => {
    expect(joinCumulative(['एक', 'एक नया', 'एक नया बंदा', 'एक नया बंदा आया समीर', 'एक नया बंदा आया समीर'])).toBe('एक नया बंदा आया समीर');
  });
  it('still joins separate parts', () => {
    expect(joinCumulative(['शर्मा जी', 'के 500'])).toBe('शर्मा जी के 500');
  });
  it('mixes both and ignores blanks', () => {
    expect(joinCumulative(['शर्मा', ' ', 'शर्मा जी', 'के 500', 'के 500'])).toBe('शर्मा जी के 500');
  });
});
