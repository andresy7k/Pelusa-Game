package com.pelusa.infrastructure.web.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record StealRequest(@NotNull UUID playerId, @Min(1) @Max(10) int value) {}
