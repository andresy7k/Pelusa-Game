package db.migration;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/**
 * V4: completa el rename DUST_PILE→DECK. V1 definía DOS checks sobre
 * cards.location: el inline {@code CHECK (location IN (...))} (nombre
 * autogenerado: distinto en Postgres y H2) y el nombrado {@code chk_owner}.
 * V3 solo migró el nombrado; el inline seguía rechazando 'DECK' (500 en
 * create). Esta migración descubre por information_schema todos los CHECK
 * sobre cards(location), los elimina y recrea los canónicos con DECK.
 */
public class V4__DeckCheckFix extends BaseJavaMigration {

  private static final String FIND =
      "SELECT tc.constraint_name FROM information_schema.table_constraints tc "
          + "JOIN information_schema.constraint_column_usage ccu "
          + "ON ccu.constraint_name = tc.constraint_name "
          + "WHERE UPPER(tc.table_name) = 'CARDS' "
          + "AND UPPER(ccu.column_name) = 'LOCATION' "
          + "AND tc.constraint_type = 'CHECK'";

  private static final String LOCATION_CHECK =
      "ALTER TABLE cards ADD CONSTRAINT cards_location_check "
          + "CHECK (location IN ('DECK','FRONT','STASHED','DISCARDED'))";

  private static final String OWNER_CHECK =
      "ALTER TABLE cards ADD CONSTRAINT chk_owner CHECK ("
          + "(location = 'DECK' AND owner_player_id IS NULL) OR "
          + "(location IN ('FRONT','STASHED','DISCARDED') AND owner_player_id IS NOT NULL))";

  @Override
  public void migrate(Context context) throws Exception {
    Connection c = context.getConnection();
    List<String> names = new ArrayList<>();
    try (Statement s = c.createStatement();
        ResultSet rs = s.executeQuery(FIND)) {
      while (rs.next()) {
        names.add(rs.getString(1));
      }
    }
    try (Statement s = c.createStatement()) {
      for (String name : names) {
        s.execute("ALTER TABLE cards DROP CONSTRAINT " + name);
      }
      s.execute(LOCATION_CHECK);
      s.execute(OWNER_CHECK);
    }
  }
}
