import { useState, useEffect, useRef } from 'react'
import { findLendingPathsStreaming, MAX_PATH_DEPTH } from '../utils/pathfinding'
import type { LendingPath } from '../utils/pathfinding'
import { Sdk } from '@aboutcircles/sdk'
import { circlesConfig } from '@aboutcircles/sdk-core'

export interface EnrichedLendingPath extends LendingPath {
  // Add profile metadata
  profiles: {
    address: string
    name?: string
    image?: string
  }[]
}

/**
 * Hook to find and enrich lending paths with profile metadata, streaming results as they're found
 */
export function useLendingPaths(borrowerAddress: string | undefined, enabled: boolean = true) {
  const [paths, setPaths] = useState<EnrichedLendingPath[]>([])
  const [currentDepth, setCurrentDepth] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const seenPaths = useRef(new Set<string>())

  useEffect(() => {
    if (!borrowerAddress || !enabled) return

    const sdk = new Sdk(circlesConfig[100])
    const profileCache = new Map<string, { name?: string; image?: string }>()

    async function enrichPath(path: LendingPath): Promise<EnrichedLendingPath> {
      // Fetch profiles for addresses we don't have cached
      const profilePromises = path.path.map(async (addr) => {
        if (profileCache.has(addr)) {
          return { address: addr, ...profileCache.get(addr)! }
        }

        try {
          const avatarData = await sdk.data.getAvatar(addr as `0x${string}`)
          if (avatarData?.cidV0) {
            const profile = await sdk.profiles.get(avatarData.cidV0)
            const result = {
              address: addr,
              name: profile?.name,
              image: profile?.previewImageUrl,
            }
            profileCache.set(addr, { name: result.name, image: result.image })
            return result
          }
        } catch (err) {
          console.error(`Failed to fetch profile for ${addr}:`, err)
        }

        const result = { address: addr, name: undefined, image: undefined }
        profileCache.set(addr, { name: undefined, image: undefined })
        return result
      })

      const profiles = await Promise.all(profilePromises)
      const sourceProfile = profiles[0]

      return {
        ...path,
        sourceName: sourceProfile?.name,
        sourceImage: sourceProfile?.image,
        profiles,
      }
    }

    async function loadPaths() {
      setIsLoading(true)
      setError(null)
      setPaths([])
      setCurrentDepth(null)
      seenPaths.current.clear()

      try {
        await findLendingPathsStreaming(
          borrowerAddress,
          MAX_PATH_DEPTH,
          async (path) => {
            // Dedupe by path addresses
            const pathKey = path.path.join('-')
            if (seenPaths.current.has(pathKey)) {
              console.log('Skipping duplicate path:', pathKey)
              return
            }
            seenPaths.current.add(pathKey)

            // Add path immediately without enrichment, enrich in background
            const unenriched: EnrichedLendingPath = {
              ...path,
              profiles: path.path.map(addr => ({ address: addr, name: undefined, image: undefined }))
            }
            setPaths(prev => [...prev, unenriched])

            // Enrich in background (don't await!)
            enrichPath(path).then(enriched => {
              setPaths(prev => prev.map(p =>
                p.path.join('-') === pathKey ? enriched : p
              ))
            })
          },
          (depth) => {
            setCurrentDepth(depth)
          }
        )
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to find paths'))
      } finally {
        setIsLoading(false)
        setCurrentDepth(null)
      }
    }

    loadPaths()
  }, [borrowerAddress, enabled])

  return { data: paths, isLoading, error, currentDepth }
}
