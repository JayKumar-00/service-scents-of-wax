import { GeocodeDto } from '../dto/geo-code.dto';

export function buildAddressString(dto: GeocodeDto): string {
  return [dto.village, dto.area, dto.city, dto.state, dto.country]
    .filter(Boolean)
    .join(', ');
}
