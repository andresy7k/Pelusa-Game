package com.pelusa.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Unirse por código: código de invitación + nombre (1-60).
 * {@code @NotBlank}: sin él, un body sin "code" llegaba null al service → 500.
 */
public record JoinRequest(
    @NotBlank @Size(min = 4, max = 12) String code,
    @NotBlank @Size(min = 1, max = 60) String name) {}
