import { useEffect, useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  createEndpointDraft,
  createGuidePageDraft,
} from "./helpers";
import type {
  Endpoint,
  EndpointDraft,
  GuidePage,
  GuidePageDraft,
} from "./types";

export function useEndpointDraft(endpoint: Endpoint, endpointSlug?: string) {
  const [draft, setDraft] = useState<EndpointDraft | null>(null);
  const [draftEndpointId, setDraftEndpointId] =
    useState<Id<"apiEndpoints"> | null>(null);
  const [savedDraft, setSavedDraft] = useState("");

  useEffect(() => {
    setDraft(null);
    setDraftEndpointId(null);
    setSavedDraft("");
  }, [endpointSlug]);

  useEffect(() => {
    if (!endpoint) return;
    const next = createEndpointDraft(endpoint);
    setDraft(next);
    setDraftEndpointId(endpoint._id);
    setSavedDraft(JSON.stringify(next));
  }, [endpoint?._id, endpoint?.updatedAt]);

  return {
    draft,
    setDraft,
    draftEndpointId,
    savedDraft,
    setSavedDraft,
  };
}

export function useGuidePageDraft(guidePage: GuidePage, guideSlug?: string) {
  const [draft, setDraft] = useState<GuidePageDraft | null>(null);
  const [savedDraft, setSavedDraft] = useState("");

  useEffect(() => {
    setDraft(null);
    setSavedDraft("");
  }, [guideSlug]);

  useEffect(() => {
    if (!guidePage) return;
    const next = createGuidePageDraft(guidePage);
    setDraft(next);
    setSavedDraft(JSON.stringify(next));
  }, [guidePage?._id, guidePage?.updatedAt]);

  return { draft, setDraft, savedDraft, setSavedDraft };
}
