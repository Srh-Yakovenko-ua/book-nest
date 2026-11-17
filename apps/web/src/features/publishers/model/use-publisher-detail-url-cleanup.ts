import { useQueryStates } from "nuqs";
import { useEffect } from "react";

import {
  createPublisherDetailUrlParsers,
  publisherDetailUrlNormalization,
} from "./publisher-detail-url";

export function usePublisherDetailUrlCleanup() {
  const [urlState, setUrlState] = useQueryStates(createPublisherDetailUrlParsers());

  useEffect(() => {
    const normalization = publisherDetailUrlNormalization(urlState);
    if (normalization === null) return;
    void setUrlState(normalization, { history: "replace" });
  }, [setUrlState, urlState]);
}
