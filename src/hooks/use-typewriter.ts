"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface UseTypewriterOptions {
  speed?: number;
  startDelay?: number;
  enabled?: boolean;
}

export function useTypewriter(
  text: string,
  { speed = 30, startDelay = 0, enabled = true }: UseTypewriterOptions = {},
) {
  const [displayed, setDisplayed] = useState(enabled ? "" : text);
  const [isDone, setIsDone] = useState(!enabled);
  const indexRef = useRef(0);
  const prevTextRef = useRef(text);

  useEffect(() => {
    if (!enabled) {
      setDisplayed(text);
      setIsDone(true);
      return;
    }

    if (text === prevTextRef.current && indexRef.current > 0) {
      return;
    }

    if (text.startsWith(prevTextRef.current) && prevTextRef.current.length > 0) {
      prevTextRef.current = text;
    } else {
      indexRef.current = 0;
      prevTextRef.current = text;
    }

    setIsDone(false);

    const timeout = setTimeout(() => {
      const interval = setInterval(() => {
        indexRef.current += 1;
        if (indexRef.current >= text.length) {
          setDisplayed(text);
          setIsDone(true);
          clearInterval(interval);
        } else {
          setDisplayed(text.slice(0, indexRef.current));
        }
      }, speed);

      return () => clearInterval(interval);
    }, indexRef.current === 0 ? startDelay : 0);

    return () => clearTimeout(timeout);
  }, [text, speed, startDelay, enabled]);

  const skip = useCallback(() => {
    indexRef.current = text.length;
    setDisplayed(text);
    setIsDone(true);
  }, [text]);

  return { displayed, isDone, skip };
}
