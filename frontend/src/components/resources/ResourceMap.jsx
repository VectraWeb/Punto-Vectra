// ResourceMap.jsx — Vista genérica del mapa de recursos.
// Evolución de SalonView/SalonFloor hacia un componente por tipo de negocio.
// No duplica lógica: delega en SalonFloor (implementación actual) y agrega
// labels dinámicos según la organización. Para restaurante el resultado
// visual es idéntico al actual.

import SalonFloor from '../SalonFloor';
import { resourceLabelOf, resourcePluralOf, articleOf } from '../../config/businessTypes';

export default function ResourceMap({ organization = null, resources, ...props }) {
  const resourceLabel = props.resourceLabel || resourceLabelOf(organization);
  const resourcePlural = props.resourcePlural || resourcePluralOf(organization);
  const article = props.article || articleOf(organization);

  return (
    <SalonFloor
      {...props}
      tables={props.tables || resources}
      resourceLabel={resourceLabel}
      resourcePlural={resourcePlural}
      article={article}
    />
  );
}
