"use client"

import {
  LineInputProps,
  LineOutputProps,
  Token,
  TokenInputProps,
  TokenOutputProps,
} from "prism-react-renderer"
import React, { useCallback, useMemo, useRef } from "react"
import { CodeBlockCollapsibleLines } from "../../components/CodeBlock/Collapsible/Lines"
import { useCollapsible } from "../use-collapsible"

export type HighlightProps = {
  getLineProps: (input: LineInputProps) => LineOutputProps
  getTokenProps: (input: TokenInputProps) => TokenOutputProps
}

export type CollapsibleCodeLines = {
  collapsibleLinesStr?: string
  getLines: (
    token: Token[][],
    highlightProps: HighlightProps,
    lineNumberOffset?: number
  ) => React.JSX.Element[]
}

export type CollapsedCodeLinesPosition = "start" | "end"

export const useCollapsibleCodeLines = ({
  collapsibleLinesStr,
  getLines,
}: CollapsibleCodeLines) => {
  const collapsedRange:
    | {
        start: number
        end: number | undefined
      }
    | undefined = useMemo(() => {
    if (!collapsibleLinesStr) {
      return
    }

    const splitCollapsedLines = collapsibleLinesStr
      .split("-")
      .map((lineNumber) => parseInt(lineNumber))

    if (
      !splitCollapsedLines.length ||
      (splitCollapsedLines.length >= 2 &&
        splitCollapsedLines[0] !== 1 &&
        splitCollapsedLines[1] < 2)
    ) {
      return
    }

    return {
      start: splitCollapsedLines[0],
      end: splitCollapsedLines[1],
    }
  }, [collapsibleLinesStr])

  const isCollapsible = useCallback(
    (tokens: Token[][]) => {
      return collapsedRange && collapsedRange.start < tokens.length
    },
    [collapsedRange]
  )

  const type: CollapsedCodeLinesPosition | undefined = useMemo(() => {
    if (!collapsedRange) {
      return undefined
    }
    return collapsedRange.start === 1 ? "start" : "end"
  }, [collapsedRange])

  const ref = useRef(null)
  const collapsibleHookResult = useCollapsible({
    unmountOnExit: false,
    translateEnabled: false,
    heightAnimation: true,
    childrenRef: ref,
  })

  const getCollapsedLinesElm = useCallback(
    ({
      tokens,
      highlightProps,
    }: {
      tokens: Token[][]
      highlightProps: HighlightProps
    }) => {
      if (!collapsedRange || !type || !isCollapsible(tokens)) {
        return <></>
      }

      const startIndex =
        type === "start" ? collapsedRange.start - 1 : collapsedRange.start

      const lines = tokens.slice(
        startIndex,
        collapsedRange.end
          ? Math.min(collapsedRange.end, tokens.length)
          : tokens.length
      )

      return (
        <CodeBlockCollapsibleLines {...collapsibleHookResult} type={type}>
          {getLines(lines, highlightProps, startIndex)}
        </CodeBlockCollapsibleLines>
      )
    },
    [collapsedRange, collapsibleHookResult, isCollapsible, type]
  )

  const getNonCollapsedLinesElm = useCallback(
    ({
      tokens,
      highlightProps,
    }: {
      tokens: Token[][]
      highlightProps: HighlightProps
    }) => {
      if (!collapsedRange || !isCollapsible(tokens)) {
        return getLines(tokens, highlightProps)
      }

      const isCollapseBeginning = collapsedRange.start === 1
      const lines = tokens.slice(
        isCollapseBeginning ? collapsedRange.end || tokens.length : 0,
        isCollapseBeginning ? undefined : collapsedRange.start
      )

      return getLines(
        lines,
        highlightProps,
        isCollapseBeginning ? collapsedRange.end : 0
      )
    },
    [collapsedRange, collapsibleHookResult, isCollapsible]
  )

  return {
    getCollapsedLinesElm,
    getNonCollapsedLinesElm,
    type,
    isCollapsible,
    ...collapsibleHookResult,
  }
}
