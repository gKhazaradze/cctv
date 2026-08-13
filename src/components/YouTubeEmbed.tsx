interface Props {
  videoId?: string
  /** Follows whatever this channel currently has live. */
  channelId?: string
  title: string
  /** Theater view gets full controls; grid tiles stay chrome-free. */
  controls?: boolean
  autoplay?: boolean
}

/** Poster frame for a stream we have not started yet. */
export function youtubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}

/**
 * Embeds a public YouTube live stream.
 *
 * Uses youtube-nocookie.com so simply loading the wall does not drop tracking
 * cookies on the viewer. Streams are always muted on load — browsers block
 * autoplay with sound, and a dozen tiles unmuting at once would be unusable
 * regardless.
 */
export function YouTubeEmbed({ videoId, channelId, title, controls = false, autoplay = true }: Props) {
  const params = new URLSearchParams({
    autoplay: autoplay ? '1' : '0',
    mute: '1',
    playsinline: '1',
    rel: '0',
    modestbranding: '1',
    controls: controls ? '1' : '0',
  })

  const src = channelId
    ? `https://www.youtube-nocookie.com/embed/live_stream?channel=${encodeURIComponent(
        channelId,
      )}&${params}`
    : `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId ?? '')}?${params}`

  return (
    <iframe
      className="feed-media"
      src={src}
      title={title}
      loading="lazy"
      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  )
}
