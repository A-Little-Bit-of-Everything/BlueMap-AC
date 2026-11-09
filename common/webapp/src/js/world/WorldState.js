/*
 * This file is part of BlueMap, licensed under the MIT License (MIT).
 *
 * Copyright (c) Blue (Lukas Rieger) <https://bluecolored.de>
 * Copyright (c) contributors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
import { reactive } from "vue";
import { RevalidatingFileLoader } from "../util/RevalidatingFileLoader";
import { alert, dispatchEvent } from "../util/Utils";

export function calculateSunlight(dayTime, raining = false, thundering = false, skyLight = true) {
    if (!skyLight) return 1.0;

    let tick = ((dayTime % 24000) + 24000) % 24000;
    let baseLight;
    if (tick >= 1000 && tick < 11500) {
        baseLight = 1.0;
    } else if (tick >= 11500 && tick < 13500) {
        let progress = (tick - 11500) / 2000.0;
        baseLight = 0.25 + 0.75 * (0.5 + 0.5 * Math.cos(progress * Math.PI));
    } else if (tick >= 13500 && tick < 22500) {
        baseLight = 0.25;
    } else {
        let progress = tick >= 22500 ? (tick - 22500) / 2500.0 : (tick + 1500) / 2500.0;
        baseLight = 0.25 + 0.75 * (0.5 - 0.5 * Math.cos(progress * Math.PI));
    }

    if (thundering) {
        baseLight *= 0.6;
    } else if (raining) {
        baseLight *= 0.8;
    }

    return Math.round(baseLight * 1000.0) / 1000.0;
}

export function formatMinecraftTime(dayTime) {
    let tick = ((dayTime % 24000) + 24000) % 24000;
    let totalMinutes = Math.floor((tick / 1000 + 6) * 60) % (24 * 60);
    let hours = Math.floor(totalMinutes / 60);
    let minutes = Math.floor(totalMinutes % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export class WorldStateManager {
    constructor(events = null) {
        this.events = events;
        this.fileUrl = null;
        this.disposed = false;
        this._paused = false;
        this._updateInterval = null;
        this._updateIntervalMillis = 5000;

        this.lastServerTick = 6000;
        this.lastServerTimestamp = performance.now();
        this.currentTick = 6000;

        this.data = reactive({
            dayTime: 6000,
            sunlight: 1.0,
            raining: false,
            thundering: false,
            skyLight: true,
            daylightCycle: true,
            hasData: false,
            liveDaylight: true,
            formattedTime: "12:00",
            isDay: true
        });
    }

    setFileUrl(url) {
        this.fileUrl = url;
    }

    updateFromData(data) {
        if (!data || typeof data.dayTime === "undefined") return false;

        this.lastServerTick = data.dayTime;
        this.lastServerTimestamp = performance.now();
        this.currentTick = data.dayTime;

        this.data.hasData = true;
        this.data.dayTime = data.dayTime;
        this.data.raining = !!data.raining;
        this.data.thundering = !!data.thundering;
        this.data.skyLight = data.skyLight !== false;
        this.data.daylightCycle = data.daylightCycle !== false;

        this.tick(true);

        if (this.events) {
            dispatchEvent(this.events, "bluemapWorldUpdated", { worldState: this.data });
        }

        return true;
    }

    tick(force = false) {
        if (!this.data.hasData && !force) return this.data.sunlight;

        let now = performance.now();
        if (this.data.daylightCycle) {
            let elapsedMs = now - this.lastServerTimestamp;
            // 20 Minecraft ticks per second = 0.02 ticks per ms
            this.currentTick = this.lastServerTick + elapsedMs * 0.02;
        } else {
            this.currentTick = this.lastServerTick;
        }

        let tickOfDay = ((Math.floor(this.currentTick) % 24000) + 24000) % 24000;
        this.data.dayTime = tickOfDay;
        this.data.formattedTime = formatMinecraftTime(tickOfDay);
        this.data.isDay = tickOfDay >= 0 && tickOfDay < 12000;

        let calculatedLight = calculateSunlight(
            this.currentTick,
            this.data.raining,
            this.data.thundering,
            this.data.skyLight
        );
        this.data.sunlight = calculatedLight;

        return calculatedLight;
    }

    setLiveDaylight(enabled) {
        this.data.liveDaylight = !!enabled;
    }

    load() {
        if (!this.fileUrl) return Promise.resolve(false);
        return new Promise((resolve) => {
            let loader = new RevalidatingFileLoader();
            loader.setResponseType("json");
            loader.load(
                this.fileUrl,
                json => {
                    resolve(this.updateFromData(json));
                },
                undefined,
                () => {
                    resolve(false);
                }
            );
        });
    }

    setAutoUpdateInterval(ms) {
        this._updateIntervalMillis = ms;
        if (this._updateInterval) clearTimeout(this._updateInterval);
        if (!this._paused && ms > 0) {
            let autoUpdate = () => {
                if (this.disposed) return;
                this.load().finally(() => {
                    if (!this._paused && !this.disposed && this._updateIntervalMillis > 0) {
                        this._updateInterval = setTimeout(autoUpdate, this._updateIntervalMillis);
                    }
                });
            };
            this._updateInterval = setTimeout(autoUpdate, ms);
        }
    }

    pauseAutoUpdates() {
        this._paused = true;
        if (this._updateInterval) clearTimeout(this._updateInterval);
    }

    resumeAutoUpdates() {
        if (this.disposed) return;
        this._paused = false;
        this.setAutoUpdateInterval(this._updateIntervalMillis);
    }

    dispose() {
        this.disposed = true;
        this.pauseAutoUpdates();
    }
}
