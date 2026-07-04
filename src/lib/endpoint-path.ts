export type EndpointParameter = {
  name: string;
  location: string;
  required: boolean;
  description: string;
  dataType: string;
};

const PATH_PLACEHOLDER_PATTERN = /\{([^{}]+)\}/g;

/**
 * Extracts path parameter placeholder names from an endpoint path template.
 *
 * @param path - Path or route value to normalize or append.
 * @returns Result produced by the function.
 */
export const extractPathPlaceholders = (path: string) => {
  return Array.from(path.matchAll(PATH_PLACEHOLDER_PATTERN))
    .map((match) => match[1].trim())
    .filter(
      (name, index, names) => Boolean(name) && names.indexOf(name) === index,
    );
};

/**
 * Normalizes an endpoint path to a leading-slash path without trailing slash noise.
 *
 * @param path - Path or route value to normalize or append.
 * @returns Result produced by the function.
 */
export const normalizeEndpointPath = (path: string) => {
  const trimmedPath = path.trim();
  if (!trimmedPath) return "/";

  const pathname = trimmedPath.split(/[?#]/, 1)[0];
  return `/${pathname.replace(/^\/+/, "").replace(/\/{2,}/g, "/")}`;
};

/**
 * Joins a base URL and endpoint path into a single request URL.
 *
 * @param baseUrl - API base URL.
 * @param path - Path or route value to normalize or append.
 * @returns Result produced by the function.
 */
export const joinEndpointUrl = (baseUrl: string, path: string) => {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
  const normalizedPath = normalizeEndpointPath(path);
  return normalizedBaseUrl
    ? `${normalizedBaseUrl}${normalizedPath}`
    : normalizedPath;
};

/**
 * Synchronizes endpoint path parameters after a path template changes.
 *
 * @param previousPath - Previous endpoint path template.
 * @param nextPath - New endpoint path template.
 * @param parameters - Endpoint parameter definitions.
 * @returns Result produced by the function.
 */
export const syncPathParameters = (
  previousPath: string,
  nextPath: string,
  parameters: EndpointParameter[],
) => {
  const previousNames = extractPathPlaceholders(previousPath);
  const nextNames = extractPathPlaceholders(nextPath);
  const nextNameSet = new Set(nextNames);
  const existingPathParameters = parameters.filter(
    (parameter) => parameter.location === "path",
  );
  const nonPathParameters = parameters.filter(
    (parameter) => parameter.location !== "path",
  );
  const claimedParameters = new Set<EndpointParameter>();

  const syncedPathParameters = nextNames.map((name, index) => {
    const exactMatch = existingPathParameters.find(
      (parameter) =>
        parameter.name === name && !claimedParameters.has(parameter),
    );
    if (exactMatch) {
      claimedParameters.add(exactMatch);
      return { ...exactMatch, required: true };
    }

    const previousName = previousNames[index];
    const renamedMatch = existingPathParameters.find(
      (parameter) =>
        parameter.name === previousName &&
        !nextNameSet.has(parameter.name) &&
        !claimedParameters.has(parameter),
    );
    if (renamedMatch) {
      claimedParameters.add(renamedMatch);
      return { ...renamedMatch, name, required: true };
    }

    return {
      name,
      location: "path",
      required: true,
      description: "",
      dataType: "string",
    };
  });

  const unmatchedPathParameters = existingPathParameters.filter(
    (parameter) => !claimedParameters.has(parameter),
  );

  return [
    ...syncedPathParameters,
    ...unmatchedPathParameters,
    ...nonPathParameters,
  ];
};
