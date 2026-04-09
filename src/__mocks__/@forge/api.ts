// Mock @forge/api
const mockRequestJira = jest.fn();

const api = {
  asApp: () => ({
    requestJira: mockRequestJira,
  }),
};

export const route = (strings: TemplateStringsArray, ...values: unknown[]) => {
  return strings.reduce((acc, str, i) => acc + str + (values[i] ?? ''), '');
};

export default api;
export { mockRequestJira };
