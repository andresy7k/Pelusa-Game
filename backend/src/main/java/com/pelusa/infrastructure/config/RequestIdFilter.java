package com.pelusa.infrastructure.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Correlation ID: respeta X-Request-Id entrante o genera uno.
 * Permite trazar request → logs → error requestId (API_CONTRACT).
 */
@Component
public class RequestIdFilter extends OncePerRequestFilter {
  static final String HEADER = "X-Request-Id";
  static final String MDC_KEY = "requestId";

  @Override
  protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
      throws ServletException, IOException {
    String id = req.getHeader(HEADER);
    if (id == null || id.isBlank()) {
      id = "req_" + UUID.randomUUID().toString().substring(0, 8);
    }
    MDC.put(MDC_KEY, id);
    res.setHeader(HEADER, id);
    try {
      chain.doFilter(req, res);
    } finally {
      MDC.remove(MDC_KEY);
    }
  }
}
