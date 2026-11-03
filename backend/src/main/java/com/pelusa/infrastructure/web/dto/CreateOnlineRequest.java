package com.pelusa.infrastructure.web.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Abrir sala online: nombre del host (1-60) + cupo de 2 a 6. */
public record CreateOnlineRequest(
    @NotBlank @Size(min = 1, max = 60) String name,
    @Min(2) @Max(6) int capacity) {}
