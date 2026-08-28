export const sectorNames = [
  "Tài chính",
  "Bất động sản & Xây dựng",
  "Dầu khí & Năng lượng",
  "Vật liệu cơ bản",
  "Công nghiệp",
  "Hàng tiêu dùng",
  "Dịch vụ tiêu dùng",
  "Y tế & Dược phẩm",
  "Công nghệ thông tin",
  "Tiện ích công cộng",
];

export function isKnownSector(value: string): boolean {
  return sectorNames.includes(value);
}
