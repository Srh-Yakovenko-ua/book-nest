import { useQueryStates } from "nuqs";
import { useEffect } from "react";

import {
  publisherBooksUrl,
  type PublisherDetailTab,
  publisherDetailUrlNormalization,
  publisherDetailUrlParsers,
  publisherOverviewUrl,
  resolvePublisherDetailTab,
} from "./publisher-detail-url";

export function usePublisherDetailTab() {
  const [urlState, setUrlState] = useQueryStates(publisherDetailUrlParsers);
  const tab = resolvePublisherDetailTab(urlState.tab);

  useEffect(() => {
    const normalization = publisherDetailUrlNormalization(urlState);
    if (normalization === null) return;
    void setUrlState(normalization, { history: "replace" });
  }, [setUrlState, urlState]);

  function selectTab(next: PublisherDetailTab) {
    if (next === tab) return;
    void setUrlState(next === "books" ? publisherBooksUrl() : publisherOverviewUrl(), {
      history: "push",
    });
  }

  return { selectTab, tab };
}
