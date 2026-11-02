package com.pelusa.infrastructure.web.dto;

import jakarta.validation.constraints.Size;

/** Unirse por código: código de invitación + nombre (1-60). */
public record JoinRequest(
    @Size(min = 4, max = 12) String code,
    @Size(min = 1, max = 60) String name) {}
