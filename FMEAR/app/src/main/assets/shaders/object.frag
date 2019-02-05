/*
 * Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

precision mediump float;

uniform sampler2D u_Texture;
uniform vec4 u_LightingParameters;

struct Material {
    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
    float shininess;
    float opacity;
};

uniform Material u_MaterialParameters;
uniform vec4 u_ObjectColorCorrection; // used for texture-less objects

uniform vec4 u_ColorCorrectionParameters;

varying vec3 v_ViewPosition;
varying vec3 v_ViewNormal;
varying vec2 v_TexCoord;

void main() {
    // We support approximate sRGB gamma.
    const float kGamma = 0.4545454;
    const float kInverseGamma = 2.2;
    const float kMiddleGrayGamma = 0.466;

    // Unpack lighting and material parameters for better naming.
    vec3 viewLightDirection = u_LightingParameters.xyz;
    vec3 colorShift = u_ColorCorrectionParameters.rgb;
    float averagePixelIntensity = u_ColorCorrectionParameters.a;

    vec3 materialAmbient = u_MaterialParameters.ambient;
    vec3 materialDiffuse = u_MaterialParameters.diffuse;
    vec3 materialSpecular = u_MaterialParameters.specular;
    float materialSpecularPower = u_MaterialParameters.shininess;
    float materialOpacity = u_MaterialParameters.opacity;

    // Normalize varying parameters, because they are linearly interpolated in the vertex shader.
    vec3 viewFragmentDirection = normalize(v_ViewPosition);
    vec3 viewNormal = normalize(v_ViewNormal);

    // Ambient light is unaffected by the light intensity.
    vec3 ambient = materialAmbient;

    // Approximate a hemisphere light (not a harsh directional light).
    vec3 diffuse = materialDiffuse *
            0.5 * (dot(viewNormal, viewLightDirection) + 1.0);

    // Compute specular light.
    vec3 reflectedLightDirection = reflect(viewLightDirection, viewNormal);
    float specularStrength = max(0.0, dot(viewFragmentDirection, reflectedLightDirection));
    vec3 specular = materialSpecular *
            pow(specularStrength, materialSpecularPower);

    // Apply inverse SRGB gamma to the texture before making lighting calculations.
    // Flip the y-texture coordinate to address the texture from top-left.
    // if no texture, u_ObjectColorCorrection will be pure white(1,1,1), otherwise black(0,0,0)
    vec4 objectColor = texture2D(u_Texture, vec2(v_TexCoord.x, 1.0 - v_TexCoord.y)) + u_ObjectColorCorrection;
    objectColor.a *= materialOpacity;

    objectColor.rgb = objectColor.rgb * (ambient + diffuse);
    objectColor.rgb = pow(objectColor.rgb, vec3(kInverseGamma));

    vec3 color = objectColor.rgb + specular;
    // Apply SRGB gamma before writing the fragment color.
    color.rgb = pow(color, vec3(kGamma));
    // Apply average pixel intensity and color shift
    color *= colorShift * (averagePixelIntensity / kMiddleGrayGamma);

    // If the pixel in the texture is nearly transparent, we can simply discard the pixel
    // REFERENCE: https://www.opengl.org/sdk/docs/tutorials/ClockworkCoders/discard.php
    // REFERENCE: https://learnopengl.com/Advanced-OpenGL/Blending
    if (objectColor.a >= 0.1)
    {
        gl_FragColor.a = objectColor.a;
    }
    else
    {
        discard;
    }

    gl_FragColor.rgb = color;
}
