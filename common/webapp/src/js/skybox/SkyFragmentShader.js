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

// language=GLSL
export const SKY_FRAGMENT_SHADER = `
uniform float sunlightStrength;
uniform float ambientLight;
uniform vec3 skyColor;
uniform vec3 voidColor;
uniform vec3 sunDirection;
uniform float dayTime;

uniform sampler2D sunTexture;
uniform sampler2D moonTexture;
uniform vec4 moonUv;

varying vec3 vPosition;

float hash31(vec3 p) {
	p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
	p *= 17.0;
	return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float getStars(vec3 dir) {
	if (dir.y <= 0.02) return 0.0;
	vec3 p = dir * 140.0;
	vec3 id = floor(p);
	vec3 f = fract(p) - 0.5;
	float rnd = hash31(id);
	if (rnd > 0.965) {
		float d = length(f);
		float star = smoothstep(0.35, 0.05, d) * (0.65 + 0.35 * sin(rnd * 40.0));
		float horizonFade = smoothstep(0.02, 0.12, dir.y);
		return star * horizonFade;
	}
	return 0.0;
}

void main() {
	vec3 dir = normalize(vPosition);
	vec3 sDir = normalize(sunDirection);
	vec3 mDir = -sDir;

	float horizonWidth = 0.02;
	float voidMultiplier = smoothstep(-horizonWidth, horizonWidth, dir.y);

	// sunlightStrength in Minecraft/BlueMap ranges from 0.25 (night) to 1.0 (day)
	float dayFactor = clamp((sunlightStrength - 0.25) / 0.75, 0.0, 1.0);
	float sunAlt = sDir.y;

	// Palette matching Minecraft client LevelRenderer
	vec3 daySky = skyColor;
	vec3 dayHorizon = mix(skyColor, vec3(0.85, 0.92, 1.0), 0.65);
	vec3 nightSky = vec3(0.012, 0.018, 0.045);
	vec3 nightHorizon = vec3(0.028, 0.038, 0.075);
	vec3 sunsetColor = vec3(1.0, 0.42, 0.12);

	// Gradients from horizon to zenith
	float heightGradient = clamp(dir.y, 0.0, 1.0);
	vec3 currentDaySky = mix(dayHorizon, daySky, pow(heightGradient, 0.6));
	vec3 currentNightSky = mix(nightHorizon, nightSky, pow(heightGradient, 0.6));

	vec3 sky = mix(currentNightSky, currentDaySky, dayFactor);

	// Sunset / Sunrise horizon glow
	float sunsetFactor = clamp(1.0 - abs(sunAlt) * 4.0, 0.0, 1.0);
	if (sunsetFactor > 0.01 && dir.y > -0.05) {
		vec3 flatSDir = vec3(sDir.x, 0.0, sDir.z);
		float flatLen = length(flatSDir);
		if (flatLen > 0.001) {
			float sunFacing = max(0.0, dot(dir, flatSDir / flatLen));
			float sunsetGlow = pow(sunFacing, 2.5) * sunsetFactor * (1.0 - pow(heightGradient, 0.4));
			sky = mix(sky, sunsetColor, sunsetGlow * 0.85);
		}
	}

	// Minecraft Moon with authentic moon_phases.png texture
	float moonCos = dot(dir, mDir);
	vec4 moonSample = vec4(0.0);
	if (moonCos > 0.2 && mDir.y > -0.3) {
		float moonFactor = clamp(1.0 - dayFactor, 0.0, 1.0);
		// Moon halo
		float halo = pow(max(0.0, moonCos), 36.0) * 0.25 + pow(max(0.0, moonCos), 6.0) * 0.06;
		vec3 haloColor = vec3(0.75, 0.85, 1.0);
		sky += haloColor * halo * moonFactor;

		// Minecraft moon_phases.png quad (size ~0.18 rad)
		vec3 mUpVec = abs(mDir.y) > 0.99 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
		vec3 mRightVec = normalize(cross(mDir, mUpVec));
		vec3 mForwardVec = cross(mRightVec, mDir);
		float mu = dot(dir, mRightVec) / moonCos;
		float mv = dot(dir, mForwardVec) / moonCos;
		float moonSize = 0.18;
		vec2 moonTexUv = vec2(mu / moonSize + 0.5, mv / moonSize + 0.5);
		if (moonTexUv.x >= 0.0 && moonTexUv.x <= 1.0 && moonTexUv.y >= 0.0 && moonTexUv.y <= 1.0) {
			vec2 mappedUv = vec2(mix(moonUv.x, moonUv.z, moonTexUv.x), mix(moonUv.y, moonUv.w, 1.0 - moonTexUv.y));
			moonSample = texture2D(moonTexture, mappedUv);
			sky += moonSample.rgb * moonFactor * 1.5;
		}
	}

	// Minecraft stars (1500 stars visible at night)
	float starVisibility = clamp(1.0 - (sunlightStrength - 0.25) / 0.35, 0.0, 1.0);
	if (starVisibility > 0.01 && dir.y > 0.0) {
		float stars = getStars(dir);
		// Hide stars behind lit moon pixels
		if (length(moonSample.rgb) > 0.02) {
			stars = 0.0;
		}
		sky += vec3(stars, stars, stars) * starVisibility;
	}

	// Minecraft Sun with authentic sun.png texture
	float sunCos = dot(dir, sDir);
	if (sunCos > 0.2 && sDir.y > -0.3) {
		// Sun corona glow
		float corona = pow(max(0.0, sunCos), 48.0) * 0.45 + pow(max(0.0, sunCos), 8.0) * 0.15;
		vec3 coronaColor = mix(vec3(1.0, 0.85, 0.6), vec3(1.0, 1.0, 0.95), clamp(sunAlt * 2.0, 0.0, 1.0));
		sky += coronaColor * corona * dayFactor;

		// Minecraft sun.png quad (size ~0.26 rad)
		vec3 upVec = abs(sDir.y) > 0.99 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
		vec3 rightVec = normalize(cross(sDir, upVec));
		vec3 forwardVec = cross(rightVec, sDir);
		float u = dot(dir, rightVec) / sunCos;
		float v = dot(dir, forwardVec) / sunCos;
		float sunSize = 0.26;
		vec2 sunTexUv = vec2(u / sunSize + 0.5, v / sunSize + 0.5);
		if (sunTexUv.x >= 0.0 && sunTexUv.x <= 1.0 && sunTexUv.y >= 0.0 && sunTexUv.y <= 1.0) {
			vec4 sunSample = texture2D(sunTexture, sunTexUv);
			sky += sunSample.rgb * dayFactor * 1.5;
		}
	}

	// Below horizon void
	vec3 adjustedVoid = voidColor * max(sunlightStrength * sunlightStrength, ambientLight);
	vec3 finalColor = mix(adjustedVoid, sky, voidMultiplier);

	gl_FragColor = vec4(finalColor, 1.0);
}
`;
