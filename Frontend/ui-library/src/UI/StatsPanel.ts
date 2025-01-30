// Copyright Epic Games, Inc. All Rights Reserved.

import { LatencyTest } from './LatencyTest';
import {
    CandidatePairStats,
    LatencyInfo,
    Logger,
    PixelStreaming,
    PixelStreamingSettings
} from '@epicgames-ps/lib-pixelstreamingfrontend-ue5.5';
import { AggregatedStats } from '@epicgames-ps/lib-pixelstreamingfrontend-ue5.5';
import { MathUtils } from '../Util/MathUtils';
import { DataChannelLatencyTest } from './DataChannelLatencyTest';
import { isSectionEnabled, StatsSections, StatsPanelConfiguration } from './UIConfigurationTypes';

/**
 * A stat structure, an id, the stat string, and the element where it is rendered.
 */
export class Stat {
    id: string;
    title: string;
    stat: string;
    element: HTMLElement;
}

/**
 * A UI component containing all the stats for the application.
 */
export class StatsPanel {
    _rootElement: HTMLElement;
    _statsCloseButton: HTMLElement;
    _statsContentElement: HTMLElement;
    _statisticsContainer: HTMLElement;
    _statsResult: HTMLElement;
    _config: StatsPanelConfiguration;

    latencyTest: LatencyTest;
    dataChannelLatencyTest: DataChannelLatencyTest;

    /* A map stats we are storing/rendering */
    statsMap = new Map<string, Stat>();

    constructor(config: StatsPanelConfiguration) {
        this._config = config;

        this.latencyTest = new LatencyTest();
        this.dataChannelLatencyTest = new DataChannelLatencyTest();
    }

    /**
     * @returns Return or creates a HTML element that represents this setting in the DOM.
     */
    public get rootElement(): HTMLElement {
        if (!this._rootElement) {
            this._rootElement = document.createElement('div');
            this._rootElement.id = 'stats-panel';
            this._rootElement.classList.add('panel-wrap');

            const panelElem = document.createElement('div');
            panelElem.classList.add('panel');
            this._rootElement.appendChild(panelElem);

            const statsHeading = document.createElement('div');
            statsHeading.id = 'statsHeading';
            statsHeading.textContent = 'Information';
            panelElem.appendChild(statsHeading);

            panelElem.appendChild(this.statsCloseButton);
            panelElem.appendChild(this.statsContentElement);
        }
        return this._rootElement;
    }

    public get statsContentElement(): HTMLElement {
        if (!this._statsContentElement) {
            this._statsContentElement = document.createElement('div');
            this._statsContentElement.id = 'statsContent';

            const streamToolStats = document.createElement('div');
            streamToolStats.id = 'streamToolsStats';
            streamToolStats.classList.add('container');

            const controlStats = document.createElement('div');
            controlStats.id = 'ControlStats';
            controlStats.classList.add('row');

            const statistics = document.createElement('section');
            statistics.id = 'statistics';
            statistics.classList.add('settingsContainer');

            const statisticsHeader = document.createElement('div');
            statisticsHeader.id = 'statisticsHeader';
            statisticsHeader.classList.add('settings-text');
            statisticsHeader.classList.add('settingsHeader');

            this._statsContentElement.appendChild(streamToolStats);
            streamToolStats.appendChild(controlStats);
            controlStats.appendChild(statistics);
            statistics.appendChild(statisticsHeader);
            if (isSectionEnabled(this._config, StatsSections.SessionStats)) {
                const sessionStats = document.createElement('div');
                sessionStats.innerHTML = StatsSections.SessionStats;
                statisticsHeader.appendChild(sessionStats);
            }
            statistics.appendChild(this.statisticsContainer);

            if (isSectionEnabled(this._config, StatsSections.LatencyTest)) {
                controlStats.appendChild(this.latencyTest.rootElement);
            }

            if (isSectionEnabled(this._config, StatsSections.DataChannelLatencyTest)) {
                controlStats.appendChild(this.dataChannelLatencyTest.rootElement);
            }
        }
        return this._statsContentElement;
    }

    public get statisticsContainer(): HTMLElement {
        if (!this._statisticsContainer) {
            this._statisticsContainer = document.createElement('div');
            this._statisticsContainer.id = 'statisticsContainer';
            this._statisticsContainer.classList.add('d-none');
            this._statisticsContainer.appendChild(this.statsResult);
        }
        return this._statisticsContainer;
    }

    public get statsResult(): HTMLElement {
        if (!this._statsResult) {
            this._statsResult = document.createElement('div');
            this._statsResult.id = 'statisticsResult';
            this._statsResult.classList.add('StatsResult');
        }
        return this._statsResult;
    }

    public get statsCloseButton(): HTMLElement {
        if (!this._statsCloseButton) {
            this._statsCloseButton = document.createElement('div');
            this._statsCloseButton.id = 'statsClose';
        }
        return this._statsCloseButton;
    }

    public onDisconnect(): void {
        this.latencyTest.latencyTestButton.onclick = () => {
            // do nothing
        };
        this.dataChannelLatencyTest.latencyTestButton.onclick = () => {
            //do nothing
        };
    }

    public onVideoInitialized(stream: PixelStreaming): void {
        // starting a latency check
        this.latencyTest.latencyTestButton.onclick = () => {
            stream.requestLatencyTest();
        };
        this.dataChannelLatencyTest.latencyTestButton.onclick = () => {
            const started = stream.requestDataChannelLatencyTest({
                duration: 1000,
                rps: 10,
                requestSize: 200,
                responseSize: 200
            });
            if (started) {
                this.dataChannelLatencyTest.handleTestStart();
            }
        };
    }

    public configure(settings: PixelStreamingSettings): void {
        if (settings.DisableLatencyTest) {
            this.latencyTest.latencyTestButton.disabled = true;
            this.latencyTest.latencyTestButton.title = 'Disabled by -PixelStreamingDisableLatencyTester=true';
            this.dataChannelLatencyTest.latencyTestButton.disabled = true;
            this.dataChannelLatencyTest.latencyTestButton.title =
                'Disabled by -PixelStreamingDisableLatencyTester=true';
            Logger.Info(
                '-PixelStreamingDisableLatencyTester=true, requesting latency report from the the browser to UE is disabled.'
            );
        }
    }

    /**
     * Show stats panel.
     */
    public show(): void {
        if (!this.rootElement.classList.contains('panel-wrap-visible')) {
            this.rootElement.classList.add('panel-wrap-visible');
        }
    }

    /**
     * Toggle the visibility of the stats panel.
     */
    public toggleVisibility(): void {
        this.rootElement.classList.toggle('panel-wrap-visible');
    }

    /**
     * Hide the stats panel.
     */
    public hide(): void {
        if (this.rootElement.classList.contains('panel-wrap-visible')) {
            this.rootElement.classList.remove('panel-wrap-visible');
        }
    }

    public handlePlayerCount(playerCount: number) {
        this.addOrUpdateStat('PlayerCountStat', 'Players', playerCount.toString());
    }

    /**
     * Handle stats coming in from browser/UE
     * @param stats - the stats structure
     */
    public handleStats(stats: AggregatedStats) {
        // format numbering based on the browser language
        const numberFormat = new Intl.NumberFormat(window.navigator.language, {
            maximumFractionDigits: 0
        });

        // Inbound data
        const inboundData = MathUtils.formatBytes(stats.inboundVideoStats.bytesReceived, 2);
        this.addOrUpdateStat('InboundDataStat', 'Received', inboundData);

        // Packets lost
        const packetsLostStat = Object.prototype.hasOwnProperty.call(stats.inboundVideoStats, 'packetsLost')
            ? numberFormat.format(stats.inboundVideoStats.packetsLost)
            : 'Chrome only';
        this.addOrUpdateStat('PacketsLostStat', 'Packets Lost', packetsLostStat);

        // Bitrate
        if (stats.inboundVideoStats.bitrate) {
            this.addOrUpdateStat(
                'VideoBitrateStat',
                'Video Bitrate (kbps)',
                stats.inboundVideoStats.bitrate.toString()
            );
        }

        if (stats.inboundAudioStats.bitrate) {
            this.addOrUpdateStat(
                'AudioBitrateStat',
                'Audio Bitrate (kbps)',
                stats.inboundAudioStats.bitrate.toString()
            );
        }

        // Video resolution
        const resStat =
            Object.prototype.hasOwnProperty.call(stats.inboundVideoStats, 'frameWidth') &&
            stats.inboundVideoStats.frameWidth &&
            Object.prototype.hasOwnProperty.call(stats.inboundVideoStats, 'frameHeight') &&
            stats.inboundVideoStats.frameHeight
                ? stats.inboundVideoStats.frameWidth + 'x' + stats.inboundVideoStats.frameHeight
                : 'Chrome only';
        this.addOrUpdateStat('VideoResStat', 'Video resolution', resStat);

        // Frames decoded
        const framesDecoded = Object.prototype.hasOwnProperty.call(stats.inboundVideoStats, 'framesDecoded')
            ? numberFormat.format(stats.inboundVideoStats.framesDecoded)
            : 'Chrome only';
        this.addOrUpdateStat('FramesDecodedStat', 'Frames Decoded', framesDecoded);

        // Framerate
        if (stats.inboundVideoStats.framesPerSecond) {
            this.addOrUpdateStat(
                'FramerateStat',
                'Framerate',
                stats.inboundVideoStats.framesPerSecond.toString()
            );
        }

        // Frames dropped
        this.addOrUpdateStat(
            'FramesDroppedStat',
            'Frames dropped',
            stats.inboundVideoStats.framesDropped?.toString()
        );

        if (stats.inboundVideoStats.codecId) {
            this.addOrUpdateStat(
                'VideoCodecStat',
                'Video codec',
                // Split the codec to remove the Fmtp line
                stats.codecs.get(stats.inboundVideoStats.codecId)?.mimeType.replace('video/', '') ?? ''
            );
        }

        if (stats.inboundAudioStats.codecId) {
            this.addOrUpdateStat(
                'AudioCodecStat',
                'Audio codec',
                // Split the codec to remove the Fmtp line
                stats.codecs.get(stats.inboundAudioStats.codecId)?.mimeType.replace('audio/', '') ?? ''
            );
        }

        // Store the active candidate pair return a new Candidate pair stat if getActiveCandidate is null
        const activeCandidatePair =
            stats.getActiveCandidatePair() != null
                ? stats.getActiveCandidatePair()
                : new CandidatePairStats();

        // RTT
        const netRTT =
            Object.prototype.hasOwnProperty.call(activeCandidatePair, 'currentRoundTripTime') &&
            stats.isNumber(activeCandidatePair.currentRoundTripTime)
                ? Math.ceil(activeCandidatePair.currentRoundTripTime * 1000).toString()
                : "Can't calculate";
        this.addOrUpdateStat('RTTStat', 'Net RTT (ms)', netRTT);

        this.addOrUpdateStat('DurationStat', 'Duration', stats.sessionStats.runTime);

        this.addOrUpdateStat(
            'ControlsInputStat',
            'Controls stream input',
            stats.sessionStats.controlsStreamInput
        );

        // QP
        if (
            stats.sessionStats.videoEncoderAvgQP !== undefined &&
            !Number.isNaN(stats.sessionStats.videoEncoderAvgQP)
        ) {
            this.addOrUpdateStat(
                'QPStat',
                'Video quantization parameter',
                stats.sessionStats.videoEncoderAvgQP.toString()
            );
        }

        Logger.Info(`--------- Stats ---------\n ${JSON.stringify(stats)}\n------------------------`);
    }

    public handleLatencyInfo(latencyInfo: LatencyInfo) {
        if (latencyInfo.SenderLatencyMs !== undefined && latencyInfo.SenderLatencyMs > 0) {
            this.addOrUpdateStat(
                'SenderSideLatency',
                'Sender latency (ms)',
                Math.ceil(latencyInfo.SenderLatencyMs).toString()
            );
        }

        if (latencyInfo.AverageAssemblyDelayMs !== undefined && latencyInfo.AverageAssemblyDelayMs > 0) {
            this.addOrUpdateStat(
                'AvgAssemblyDelay',
                'Assembly delay (ms)',
                Math.ceil(latencyInfo.AverageAssemblyDelayMs).toString()
            );
        }

        if (latencyInfo.AverageDecodeLatencyMs !== undefined && latencyInfo.AverageDecodeLatencyMs > 0) {
            this.addOrUpdateStat(
                'AvgDecodeDelay',
                'Decode time (ms)',
                Math.ceil(latencyInfo.AverageDecodeLatencyMs).toString()
            );
        }

        if (
            latencyInfo.AverageJitterBufferDelayMs !== undefined &&
            latencyInfo.AverageJitterBufferDelayMs > 0
        ) {
            this.addOrUpdateStat(
                'AvgJitterBufferDelay',
                'Jitter buffer (ms)',
                Math.ceil(latencyInfo.AverageJitterBufferDelayMs).toString()
            );
        }

        if (latencyInfo.AverageProcessingDelayMs !== undefined && latencyInfo.AverageProcessingDelayMs > 0) {
            this.addOrUpdateStat(
                'AvgProcessingDelay',
                'Processing delay (ms)',
                Math.ceil(latencyInfo.AverageProcessingDelayMs).toString()
            );
        }

        if (latencyInfo.AverageE2ELatency !== undefined && latencyInfo.AverageE2ELatency > 0) {
            this.addOrUpdateStat(
                'AvgE2ELatency',
                'Total latency (ms)',
                Math.ceil(latencyInfo.AverageE2ELatency).toString()
            );
        }
    }

    /**
     * Adds a new stat to the stats results in the DOM or updates an exiting stat.
     * @param id - The id of the stat to add/update.
     * @param stat - The contents of the stat.
     */
    public addOrUpdateStat(id: string, statLabel: string, stat: string) {
        if (!isSectionEnabled(this._config, StatsSections.SessionStats)) {
            return;
        }

        const statHTML = `${statLabel}: ${stat}`;

        if (!this.statsMap.has(id)) {
            // create the stat
            const newStat = new Stat();
            newStat.id = id;
            newStat.stat = stat;
            newStat.title = statLabel;
            newStat.element = document.createElement('div');
            newStat.element.innerHTML = statHTML;
            // add the stat to the dom
            this.statsResult.appendChild(newStat.element);
            this.statsMap.set(id, newStat);
        }
        // update the existing stat
        else {
            const value = this.statsMap.get(id);
            if (value !== undefined) {
                value.element.innerHTML = statHTML;
            }
        }
    }
}
