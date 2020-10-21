import * as functions from "../sample";

describe("Test Jest", () => {
  test("Should return Hello World!", async () => {
    const testString = await functions.sampleString("World!");
    expect(testString).toBe("Hello World!");
  });

  test("Should return sum 5", async () => {
    const sum = await functions.arithmatic(2, 3);
    expect(sum).toBe(5);
  });
});
