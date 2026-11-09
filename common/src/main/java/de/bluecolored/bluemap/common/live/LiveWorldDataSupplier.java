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
package de.bluecolored.bluemap.common.live;

import com.google.gson.stream.JsonWriter;
import de.bluecolored.bluemap.common.serverinterface.Server;
import de.bluecolored.bluemap.common.serverinterface.ServerWorld;
import de.bluecolored.bluemap.core.logger.Logger;
import de.bluecolored.bluemap.core.world.World;
import org.jetbrains.annotations.Nullable;

import java.io.IOException;
import java.io.StringWriter;
import java.util.OptionalLong;
import java.util.function.Supplier;

public class LiveWorldDataSupplier implements Supplier<String> {

    private final Server server;
    private final World world;

    private transient @Nullable ServerWorld serverWorld;

    public LiveWorldDataSupplier(Server server, World world) {
        this.server = server;
        this.world = world;
    }

    @Override
    public String get() {
        if (serverWorld == null)
            serverWorld = server.getServerWorld(world).orElse(null);

        if (serverWorld == null) return "{}";

        OptionalLong dayTimeOpt = serverWorld.getDayTime();
        if (dayTimeOpt.isEmpty()) return "{}";

        long dayTime = dayTimeOpt.getAsLong();
        boolean raining = serverWorld.isRaining();
        boolean thundering = serverWorld.isThundering();
        boolean skyLight = serverWorld.isSkyLight();
        boolean daylightCycle = serverWorld.isDaylightCycle();
        double sunlight = calculateSunlight(dayTime, raining, thundering, skyLight);

        try (StringWriter jsonString = new StringWriter();
             JsonWriter json = new JsonWriter(jsonString)) {

            json.beginObject();
            json.name("dayTime").value(dayTime);
            json.name("sunlight").value(sunlight);
            json.name("raining").value(raining);
            json.name("thundering").value(thundering);
            json.name("skyLight").value(skyLight);
            json.name("daylightCycle").value(daylightCycle);
            json.endObject();

            return jsonString.toString();
        } catch (IOException e) {
            Logger.global.logError("Failed to serialize world data to json", e);
            return "{}";
        }
    }

    public static double calculateSunlight(long dayTime, boolean raining, boolean thundering, boolean skyLight) {
        if (!skyLight) return 1.0;

        long tick = ((dayTime % 24000) + 24000) % 24000;
        double baseLight;
        if (tick >= 1000 && tick < 11500) {
            baseLight = 1.0;
        } else if (tick >= 11500 && tick < 13500) {
            double progress = (tick - 11500) / 2000.0;
            baseLight = 0.25 + 0.75 * (0.5 + 0.5 * Math.cos(progress * Math.PI));
        } else if (tick >= 13500 && tick < 22500) {
            baseLight = 0.25;
        } else {
            double progress = tick >= 22500 ? (tick - 22500) / 2500.0 : (tick + 1500) / 2500.0;
            baseLight = 0.25 + 0.75 * (0.5 - 0.5 * Math.cos(progress * Math.PI));
        }

        if (thundering) {
            baseLight *= 0.6;
        } else if (raining) {
            baseLight *= 0.8;
        }

        return Math.round(baseLight * 1000.0) / 1000.0;
    }
}
