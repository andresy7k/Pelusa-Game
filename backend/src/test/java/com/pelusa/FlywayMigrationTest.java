package com.pelusa;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/**
 * Verifica que V1 crea exactamente las 4 tablas del DATA_MODEL.
 * Usa H2 real (no mocks): si la migración está rota, este test falla.
 */
@SpringBootTest
@ActiveProfiles("test")
class FlywayMigrationTest {
  @Autowired
  JdbcTemplate jdbc;

  @Test
  void v1CreatesFourTables() {
    Integer tables = jdbc.queryForObject(
        "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME IN ('GAMES','PLAYERS','CARDS','TURNS')",
        Integer.class);
    assertThat(tables).isEqualTo(4);
  }
}
