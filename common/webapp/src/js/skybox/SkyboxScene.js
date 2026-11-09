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
import {AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, Mesh, Points, Scene, ShaderMaterial, SphereGeometry} from 'three';

import {SKY_FRAGMENT_SHADER} from './SkyFragmentShader';
import {SKY_VERTEX_SHADER} from './SkyVertexShader';
import {MINECRAFT_STAR_POSITIONS, MINECRAFT_STAR_SIZES} from './MinecraftStars';

const STAR_VERTEX_SHADER = `
attribute float aSize;
uniform float starBrightness;
uniform vec3 sunDirection;
varying float vVisibility;

void main() {
	// Rotate stars around Z axis in lockstep with the sun & moon
	vec3 sDir = normalize(sunDirection);
	float cosA = sDir.y;
	float sinA = -sDir.x;
	vec3 rotatedPos = vec3(
		position.x * cosA - position.y * sinA,
		position.x * sinA + position.y * cosA,
		position.z
	);

	vec4 worldPos = modelMatrix * vec4(rotatedPos, 1.0);
	vec3 worldDir = normalize(worldPos.xyz);

	// Fade stars near horizon so they never shine through terrain
	float horizon = smoothstep(0.01, 0.12, worldDir.y);

	// Occlude stars directly behind the moon disk
	float moonOcclusion = 1.0;
	if (dot(worldDir, -sDir) > 0.98) {
		moonOcclusion = 0.0;
	}

	vVisibility = starBrightness * horizon * moonOcclusion;

	vec4 mvPosition = viewMatrix * worldPos;
	gl_PointSize = clamp(aSize * 15.0, 1.5, 4.5);
	gl_Position = projectionMatrix * mvPosition;
}
`;

const STAR_FRAGMENT_SHADER = `
precision highp float;
varying float vVisibility;

void main() {
	if (vVisibility <= 0.01) discard;
	vec2 coord = gl_PointCoord - vec2(0.5);
	if (abs(coord.x) > 0.45 || abs(coord.y) > 0.45) discard;
	gl_FragColor = vec4(vec3(0.9, 0.95, 1.0) * vVisibility, vVisibility);
}
`;

export class SkyboxScene extends Scene {

	constructor(uniforms) {
		super();

		this.matrixWorldAutoUpdate = false;

		Object.defineProperty(this, 'isSkyboxScene', {value: true});

		let geometry = new SphereGeometry(1, 64, 32);
		let material = new ShaderMaterial({
			uniforms: uniforms,
			vertexShader: SKY_VERTEX_SHADER,
			fragmentShader: SKY_FRAGMENT_SHADER,
			side: BackSide,
			depthWrite: false
		});
		let skybox = new Mesh(geometry, material);
		skybox.renderOrder = 0;
		this.add(skybox);

		// Authentic 764 vanilla Minecraft stars
		let starGeometry = new BufferGeometry();
		starGeometry.setAttribute('position', new BufferAttribute(MINECRAFT_STAR_POSITIONS, 3));
		starGeometry.setAttribute('aSize', new BufferAttribute(MINECRAFT_STAR_SIZES, 1));

		let starMaterial = new ShaderMaterial({
			uniforms: uniforms,
			vertexShader: STAR_VERTEX_SHADER,
			fragmentShader: STAR_FRAGMENT_SHADER,
			transparent: true,
			blending: AdditiveBlending,
			depthWrite: false
		});

		this.starPoints = new Points(starGeometry, starMaterial);
		this.starPoints.renderOrder = 1;
		this.starPoints.matrixAutoUpdate = false;
		this.add(this.starPoints);
	}

}
