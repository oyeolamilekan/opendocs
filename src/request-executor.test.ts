import { describe, expect, it } from "vitest";
import { buildTargetUrl, isBlockedIp } from "./routes/api/execute";

describe("endpoint request executor", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "192.0.2.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
    "::ffff:127.0.0.1",
    "::ffff:169.254.169.254",
  ])("blocks private or special address %s", (address) => {
    expect(isBlockedIp(address)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])(
    "allows public address %s",
    (address) => {
      expect(isBlockedIp(address)).toBe(false);
    },
  );

  it("binds endpoint paths and query values to the configured origin", () => {
    const url = buildTargetUrl(
      "https://api.example.com/v1",
      "/users/{id}",
      [
        { name: "id", location: "path", required: true },
        { name: "expand", location: "query", required: false },
      ],
      { id: "user/1", expand: "profile" },
    );

    expect(url.toString()).toBe(
      "https://api.example.com/users/user%2F1?expand=profile",
    );
  });

  it("rejects cross-origin paths and nonstandard ports", () => {
    expect(() =>
      buildTargetUrl(
        "https://api.example.com",
        "https://evil.example/path",
        [],
        {},
      ),
    ).toThrow(/origin/);
    expect(() =>
      buildTargetUrl("http://api.example.com:8080", "/users", [], {}),
    ).toThrow(/ports/);
  });
});
