package com.pelusa.infrastructure.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Cabeceras de seguridad en TODAS las respuestas de la API + tope de tamaño del cuerpo.
 *
 * <ul>
 *   <li>{@code X-Content-Type-Options: nosniff}: el navegador no "adivina" tipos (evita
 *       que un JSON se interprete como HTML/JS).</li>
 *   <li>{@code X-Frame-Options: DENY} + CSP {@code frame-ancestors 'none'}: nadie puede
 *       meter la API en un iframe (clickjacking).</li>
 *   <li>CSP {@code default-src 'none'}: la API solo devuelve JSON; no debe cargar nada.</li>
 *   <li>{@code Referrer-Policy: no-referrer} y {@code Permissions-Policy}: no se filtran
 *       URLs ni se piden cámara/micrófono/ubicación.</li>
 *   <li>{@code Cache-Control: no-store}: el estado de una partida no queda en cachés.</li>
 *   <li>HSTS solo si la petición llegó por HTTPS (Render termina TLS y lo indica en
 *       {@code X-Forwarded-Proto}): obliga al navegador a usar siempre HTTPS.</li>
 * </ul>
 * Un cuerpo mayor a {@code pelusa.security.max-body-bytes} se rechaza con 413 antes de
 * leerlo: ninguna petición válida del juego pesa más de unos pocos cientos de bytes.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class SecurityHeadersFilter extends OncePerRequestFilter {
  private final long maxBodyBytes;

  public SecurityHeadersFilter(@Value("${pelusa.security.max-body-bytes:16384}") long maxBodyBytes) {
    this.maxBodyBytes = maxBodyBytes;
  }

  @Override
  protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
      throws ServletException, IOException {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cache-Control", "no-store");
    if (req.isSecure() || "https".equalsIgnoreCase(req.getHeader("X-Forwarded-Proto"))) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    if (req.getContentLengthLong() > maxBodyBytes) {
      ProblemResponses.write(res, req, 413, "Content Too Large", "PAYLOAD_TOO_LARGE",
          "El cuerpo de la petición es demasiado grande");
      return;
    }
    chain.doFilter(req, res);
  }
}
