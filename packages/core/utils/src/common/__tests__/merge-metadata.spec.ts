import { mergeMetadata } from "../merge-metadata"

describe("mergeMetadata", () => {
  it("should merge simple key-value pairs", () => {
    const metadata = {
      key1: "value1",
      key2: "value2",
    }
    const metadataToMerge = {
      key2: "new-value2",
      key3: "value3",
    }

    const result = mergeMetadata(metadata, metadataToMerge)

    expect(result).toEqual({
      key1: "value1",
      key2: "new-value2",
      key3: "value3",
    })
  })

  it("should remove keys with empty string values", () => {
    const metadata = {
      key1: "value1",
      key2: "value2",
      key3: "value3",
    }
    const metadataToMerge = {
      key2: "",
    }

    const result = mergeMetadata(metadata, metadataToMerge)

    expect(result).toEqual({
      key1: "value1",
      key3: "value3",
    })
  })
})
