import { isAxiosError } from "axios";
import type { FieldValues, UseFormSetError } from "react-hook-form";

import type { ApiValidationError } from "../types/api";

const GENERIC_SERVER_ERROR = "Algo deu errado. Tente novamente.";

export function getApiErrorMessages(error: unknown, fallback = GENERIC_SERVER_ERROR) {
  if (!isAxiosError<ApiValidationError>(error)) {
    return [fallback];
  }

  if (error.response?.status === 500) {
    return [GENERIC_SERVER_ERROR];
  }

  const message = error.response?.data?.message;

  if (Array.isArray(message)) {
    return message.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  if (typeof message === "string" && message.trim()) {
    return [message];
  }

  return [fallback];
}

export function getApiErrorText(error: unknown, fallback = GENERIC_SERVER_ERROR) {
  return getApiErrorMessages(error, fallback).join("\n");
}

export function setFieldErrorsFromApi<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: Array<keyof T & string>,
) {
  const messages = getApiErrorMessages(error);

  messages.forEach((message) => {
    const normalized = message.toLowerCase();
    const field = fields.find((item) => {
      const aliases = item === "amount" ? ["amount", "value"] : [item];
      return aliases.some((alias) => normalized.includes(alias.toLowerCase()));
    });
    if (field) {
      setError(field as never, { type: "server", message });
    }
  });

  return messages;
}
