const { Ableton } = require("ableton-js");
const wav = require('node-wav');
const fs = require('fs')
const { Client, Server } = require('node-osc')

const ableton = new Ableton({ logger: console, commandTimeoutMs: 3000 });
const RESOLUTION = 72;

const client = new Client('127.0.0.1', 39041)

const anounceWaveform = (index, waveform) => {
  return new Promise((resolve, reject) => {
    client.send('/setlist/sectionWaveform', index, ...waveform, (err) => err ? reject(err) : resolve());
  });
}

const announceCleanWaveforms = () => {
  client.send('/setlist/sectionWaveform', { type: 'i', value: -1 });
}

let dynamicsTrackId, removeDynamicsListener, sectionsTrackId, removeSectionsListener
let activeSongIndex, playheadPosition;
let sectionsStarts = [];
let songsStarts = [];
let clips = [];
let cachedCuePoints = [];
const clipsAudios = {};
let sectionCache = [];

const trackSections = (sections) => {
  sectionsStarts = sections.map(section => section.raw.start_time);
  updateSongsStarts()
  renderWaveforms()
}

const updateSongsStarts = (cuePoints = cachedCuePoints) => {
  cachedCuePoints = cuePoints

  songsStarts = [];

  cuePoints.forEach(point => {
    if (!/^\d+$/.test(point.raw.name)) {
      songsStarts.push(point.raw.time);
    } else {
      if (!sectionsStarts.find(time => time === point.raw.time)) {
        songsStarts.push(point.raw.time);
      }
    }
  })
}

const setActiveSongIndex = () => {
  const newSongIndex = songsStarts.length - songsStarts.slice().reverse().findIndex(start => start <= playheadPosition) - 1
  if (activeSongIndex !== newSongIndex) {
    activeSongIndex = newSongIndex;
    sectionCache = [];
    announceCleanWaveforms()
    renderWaveforms()
  }
}

const cachedAudio = (filePath) => {
  if (!clipsAudios[filePath]) {
    const audio = wav.decode(fs.readFileSync(filePath));
    clipsAudios[filePath] = { samples: audio.channelData[1]
      ? audio.channelData[0].map((sample, index) => (sample + audio.channelData[1][index]) / 2)
      : audio.channelData[0], sampleRate: audio.sampleRate };
  }
  return clipsAudios[filePath];
}

const trackClips = async (rawClips) => {
  clips = await Promise.all(rawClips.filter(clip => !clip.raw.muted).map(async clip => (
    { name: clip.raw.name, start: clip.raw.start_time, end: clip.raw.end_time,
      warp_markers: (await clip.get("warp_markers")),
      start_marker: (await clip.get("start_marker")),
      audio: cachedAudio(await clip.get("file_path")) }
  )));
  renderWaveforms()
}

const beatToTime = (warpMarkers, beat) => {
  if (beat <= warpMarkers[0].beat_time) {
    return warpMarkers[0].sample_time;
  }

  for (let i = 0; i < warpMarkers.length - 1; i++) {
    const marker1 = warpMarkers[i];
    const marker2 = warpMarkers[i + 1];

    if (beat >= marker1.beat_time && beat <= marker2.beat_time) {
      const beatDiff = marker2.beat_time - marker1.beat_time;
      const timeDiff = marker2.sample_time - marker1.sample_time;
      const beatOffset = beat - marker1.beat_time;
      return marker1.sample_time + (beatOffset / beatDiff) * timeDiff;
    }
  }

  const lastMarker = warpMarkers[warpMarkers.length - 1];
  const secondLastMarker = warpMarkers[warpMarkers.length - 2];
  const beatDiff = lastMarker.beat_time - secondLastMarker.beat_time;
  const timeDiff = lastMarker.sample_time - secondLastMarker.sample_time;
  const beatOffset = beat - lastMarker.beat_time;
  return lastMarker.sample_time + (beatOffset / beatDiff) * timeDiff;
};

const renderWaveforms = async () => {
  const songSections = sectionsStarts.filter(time => time >= songsStarts[activeSongIndex] && time < songsStarts[activeSongIndex + 1]);
  // for some reason node-osc doesn't send messages once we call .send function
  // for so I had to add `wait Promise` in for loop to send those as soon as data is ready
  for (let index = 0; index < songSections.length; index++) {
    const start = songSections[index]
    const end = songSections[index + 1] || songsStarts[activeSongIndex + 1];
    const sectionClips = clips.filter(clip => 
      clip.start <= start && clip.end >= end || // section is inside clip
      clip.start >= start && clip.end <= end || // clip is inside section
      clip.start <= start && clip.end >= start && clip.end <= end || // clip starts before section and ends inside section
      clip.start >= start && clip.start <= end && clip.end >= end); // clip starts inside section and ends after section
    if (sectionCache[index] && sectionCache[index] === JSON.stringify([start, end, sectionClips.map(clip => [clip.file_path, clip.start, clip.end, clip.warp_markers])])) {
      continue;
    }
    const waveform = Array(RESOLUTION).fill(0).map((_, index) => {
      const absoluteSegmentStart = start + (end - start) * index / RESOLUTION;
      const absoluteSegmentEnd = start + (end - start) * (index + 1) / RESOLUTION;
      const segmentSamples = sectionClips.map((clip) => {
        if (absoluteSegmentStart >= clip.end || absoluteSegmentEnd <= clip.start) {
          return []
        }
        const relativeSegmentStart = Math.max(absoluteSegmentStart - clip.start + clip.start_marker, clip.start_marker);
        const relativeSegmentEnd = Math.min(absoluteSegmentEnd - clip.start + clip.start_marker, clip.end - clip.start + clip.start_marker);
        const samples = clip.audio.samples.slice(beatToTime(clip.warp_markers, relativeSegmentStart) * clip.audio.sampleRate, beatToTime(clip.warp_markers, relativeSegmentEnd) * clip.audio.sampleRate)
        return [...samples]
      }).flat()

      if (segmentSamples.length === 0) {
        return [0, 0];
      }

      return [Math.round(Math.max(...segmentSamples) * RESOLUTION / 2), Math.round(Math.min(...segmentSamples) * RESOLUTION / 2)];
    });
    const unshuffledWaveform = [];
    waveform.forEach(([max, min], i) => {
      unshuffledWaveform[i] = max;
      unshuffledWaveform[i + RESOLUTION] = min;
    });
    await anounceWaveform(index, unshuffledWaveform)
    sectionCache[index] = JSON.stringify([start, end, sectionClips.map(clip => [clip.file_path, clip.start, clip.end, clip.warp_markers])])
  }
}

const bindTracks = async (tracks) => {
  const dynamicsTrack = tracks.find(track => track.raw.name.startsWith("Dynamics"));
  if (dynamicsTrack.raw.id !== dynamicsTrackId) {
    dynamicsTrackId = dynamicsTrack.raw.id;
    if (removeDynamicsListener) { removeDynamicsListener() };
    removeDynamicsListener = await dynamicsTrack.addListener("arrangement_clips", trackClips);
    trackClips(await dynamicsTrack.get("arrangement_clips"));
  }
  const sectionsTrack = tracks.find(track => track.raw.name.startsWith("Sections"));
  if (sectionsTrack.raw.id !== sectionsTrackId) {
    sectionsTrackId = sectionsTrack.raw.id;
    if (removeSectionsListener) { removeSectionsListener() };
    removeSectionsListener = await sectionsTrack.addListener("arrangement_clips", trackSections);
    trackSections(await sectionsTrack.get("arrangement_clips"));
  }
}

const main = async () => {
  await ableton.start();

  ableton.song.addListener("tracks", bindTracks)
  bindTracks(await ableton.song.get("tracks"))
  ableton.song.addListener("cue_points", updateSongsStarts);
  updateSongsStarts(await ableton.song.get("cue_points"))

  ableton.song.addListener("current_song_time", time => {
    playheadPosition = time
    setActiveSongIndex()
  });
  playheadPosition = await ableton.song.get("current_song_time")
  setActiveSongIndex()
};

main();