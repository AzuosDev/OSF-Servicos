import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { api } from "../lib/api";
import {
  WEBAUTHN_DISMISSED_KEY,
  WEBAUTHN_TRIED_KEY,
  resolveSuggestionCheck,
  resolveShowModal,
} from "../lib/webauthn-suggestion";

export function useWebAuthnSuggestion() {
  const [shouldCheck, setShouldCheck] = useState(false);
  const [isForm1, setIsForm1] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const result = resolveSuggestionCheck({
      browserSupports: browserSupportsWebAuthn(),
      triedFlag: sessionStorage.getItem(WEBAUTHN_TRIED_KEY),
      dismissedAt: localStorage.getItem(WEBAUTHN_DISMISSED_KEY),
    });
    if (result.shouldCheck) {
      setIsForm1(result.isForm1);
      setShouldCheck(true);
    }
  }, []);

  const credentialsQuery = useQuery<{ credentialId: string }[]>({
    queryKey: ["webauthn-credentials"],
    queryFn: () =>
      api.get<{ credentialId: string }[]>("/api/auth/webauthn/credentials").then((r) => r.data),
    enabled: shouldCheck,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (!shouldCheck || credentialsQuery.isLoading || credentialsQuery.data === undefined) return;
    const checkResult = resolveSuggestionCheck({
      browserSupports: browserSupportsWebAuthn(),
      triedFlag: sessionStorage.getItem(WEBAUTHN_TRIED_KEY),
      dismissedAt: localStorage.getItem(WEBAUTHN_DISMISSED_KEY),
    });
    if (!resolveShowModal(checkResult, credentialsQuery.data.length)) {
      sessionStorage.removeItem(WEBAUTHN_TRIED_KEY);
      return;
    }
    setOpen(true);
  }, [shouldCheck, credentialsQuery.isLoading, credentialsQuery.data]);

  const dismiss = () => {
    localStorage.setItem(WEBAUTHN_DISMISSED_KEY, Date.now().toString());
    sessionStorage.removeItem(WEBAUTHN_TRIED_KEY);
    setOpen(false);
  };

  const markRegistered = () => {
    sessionStorage.removeItem(WEBAUTHN_TRIED_KEY);
    setOpen(false);
  };

  return { open, isForm1, dismiss, markRegistered };
}
