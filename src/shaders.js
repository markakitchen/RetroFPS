// Global Uniforms
export const globalUniforms = {
    uTime: { value: 0 }
};

export const vShader = `
    varying vec2 vUv; varying vec3 vNormal; varying vec3 vPos;
    uniform float uTime;
    void main() {
        vUv = uv; vNormal = normal; vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

export const fShaderMagma = `
    varying vec3 vPos; uniform float uTime;
    void main() {
        float noise = sin(vPos.x * 0.5 + uTime * 5.0) * sin(vPos.y * 0.5 + uTime * 4.0);
        vec3 color = mix(vec3(0.5, 0.0, 0.0), vec3(1.0, 0.5, 0.0), noise * 0.5 + 0.5);
        gl_FragColor = vec4(color, 1.0);
    }
`;

export const fShaderDigital = `
    varying vec2 vUv; uniform float uTime;
    void main() {
        float scan = sin(vUv.y * 50.0 - uTime * 5.0);
        vec3 base = vec3(0.1, 0.1, 0.1);
        if(scan > 0.9) base = vec3(0.0, 1.0, 1.0);
        gl_FragColor = vec4(base, 1.0);
    }
`;

export const fShaderShield = `
    varying vec2 vUv; uniform float uTime;
    void main() {
        vec2 r = vUv * 10.0;
        float hex = sin(r.x + r.y) * sin(r.x - r.y);
        vec3 color = vec3(0.2, 0.0, 0.4);
        if (hex > 0.8) color += vec3(0.5, 0.0, 1.0) * abs(sin(uTime * 2.0));
        gl_FragColor = vec4(color, 1.0);
    }
`;

export const fShaderChaos = `
    varying vec3 vPos; uniform float uTime;
    void main() {
        float n = sin(vPos.x * 2.0 + uTime) + cos(vPos.y * 3.0 - uTime);
        gl_FragColor = vec4(mix(vec3(0.0), vec3(0.0, 1.0, 0.2), n * 0.5 + 0.5), 1.0);
    }
`;