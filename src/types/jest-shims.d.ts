// Jest shims to relax typing in tests that cast to jest.Mock
declare namespace jest {
  // Loosen jest.Mock typing to any to avoid structural-compatibility errors during casts in tests.
  type Mock = any;
}