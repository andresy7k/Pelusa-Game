package com.pelusa.infrastructure.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.slf4j.MDC;

/**
 * Errores RFC 7807 escritos desde un filtro: corren ANTES de llegar a Spring
 * MVC, así que no pasan por GlobalExceptionHandler. Mismo formato que el resto
 * de la API para que el frontend los entienda igual.
 */
final class ProblemResponses {
  private ProblemResponses() {}

  static void write(HttpServletResponse res, HttpServletRequest req, int status, String title,
      String errorCode, String detail) throws IOException {
    res.setStatus(status);
    res.setContentType("application/problem+json");
    res.setCharacterEncoding("UTF-8");
    String rid = MDC.get("requestId");
    res.getWriter().write("{\"type\":\"https://pelusa/errors/" + errorCode + "\""
        + ",\"title\":\"" + title + "\",\"status\":" + status
        + ",\"detail\":\"" + detail + "\",\"instance\":\"" + escape(req.getRequestURI()) + "\""
        + ",\"errorCode\":\"" + errorCode + "\""
        + (rid == null ? "" : ",\"requestId\":\"" + escape(rid) + "\"") + "}");
  }

  /** La ruta y el requestId vienen del cliente: se escapan para no romper el JSON. */
  static String escape(String text) {
    StringBuilder sb = new StringBuilder(text.length());
    for (char c : text.toCharArray()) {
      if (c == '"' || c == '\\') {
        sb.append('\\').append(c);
      } else if (c < 0x20) {
        sb.append(String.format("\\u%04x", (int) c));
      } else {
        sb.append(c);
      }
    }
    return sb.toString();
  }
}
