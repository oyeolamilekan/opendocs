import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines class name values with clsx and resolves Tailwind conflicts.
 *
 * @param inputs - Class name values accepted by clsx.
 * @returns Merged class name string.
 */
export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};
