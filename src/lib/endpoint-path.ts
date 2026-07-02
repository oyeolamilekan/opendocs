export type EndpointParameter = {
  name: string;
  location: string;
  required: boolean;
  description: string;
  dataType: string;
};

const PATH_PLACEHOLDER_PATTERN = /\{([^{}]+)\}/g;

export function extractPathPlaceholders(path: string) {
  return Array.from(path.matchAll(PATH_PLACEHOLDER_PATTERN))
    .map((match) => match[1].trim())
    .filter(
      (name, index, names) => Boolean(name) && names.indexOf(name) === index,
    );
}

export function normalizeEndpointPath(path: string) {
  const trimmedPath = path.trim();
  if (!trimmedPath) return "/";

  const pathname = trimmedPath.split(/[?#]/, 1)[0];
  return `/${pathname.replace(/^\/+/, "").replace(/\/{2,}/g, "/")}`;
}

export function joinEndpointUrl(baseUrl: string, path: string) {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
  const normalizedPath = normalizeEndpointPath(path);
  return normalizedBaseUrl
    ? `${normalizedBaseUrl}${normalizedPath}`
    : normalizedPath;
}

export function syncPathParameters(
  previousPath: string,
  nextPath: string,
  parameters: EndpointParameter[],
) {
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
}

