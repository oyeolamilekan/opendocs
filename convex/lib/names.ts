export function splitDisplayName(name: string): {
  firstName: string;
  lastName: string;
} {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const [firstName = "", ...rest] = parts;

  return {
    firstName,
    lastName: rest.join(" "),
  };
}
