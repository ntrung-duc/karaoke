export const WW_ROLES={
 wolf:['Sói','🐺','sói','Cùng bầy chọn nạn nhân mỗi đêm. Ban ngày trà trộn vào làng.'],
 villager:['Dân làng','👨‍🌾','dân','Thảo luận và bỏ phiếu để tìm hết Sói.'],
 seer:['Tiên tri','🔮','dân','Mỗi đêm soi một người để biết có phải Sói không.'],
 apprentice:['Tiên tri tập sự','✨','dân','Trở thành Tiên tri khi Tiên tri chết.'],
 detective:['Thám tử','🕵️','dân','Chọn hai người mỗi đêm để biết họ cùng phe hay khác phe.'],
 guard:['Bảo vệ','🛡️','dân','Bảo vệ một người, có thể chọn mình, không chọn cùng người hai đêm liền.'],
 hunter:['Thợ săn','🏹','dân','Khi chết được bắn một người, hoặc bỏ qua.'],
 witch:['Phù thủy','🧪','dân','Có một bình cứu và một bình độc cho cả ván. Mỗi đêm dùng tối đa một bình; không tự cứu.'],
 elder:['Già làng','🌳','dân','Chịu được lần đầu bị Sói cắn.'],
 idiot:['Kẻ ngốc','🤪','dân','Lần đầu bị biểu quyết chỉ lộ vai và mất quyền bầu. Lần thứ hai bị loại.'],
 knight:['Hiệp sĩ','⚔️','dân','Nếu bị Sói cắn chết, một Sói đã tấn công sẽ chết vào đêm kế tiếp.'],
 raven:['Quạ','🐦‍⬛','dân','Đánh dấu một người mỗi đêm để họ chịu thêm hai phiếu vào hôm sau.'],
 oldhag:['Bà già','🧓','dân','Cấm một người bỏ phiếu ngày mai; không chọn trùng hai đêm liên tiếp.'],
 sisters:['Chị em','👭','dân','Hai người theo phe Dân và biết danh tính nhau.'],
 lycan:['Người hóa sói','🌕','dân','Theo phe Dân nhưng bị Tiên tri soi ra là Sói.'],
 cursed:['Kẻ bị nguyền','🩸','dân','Bị Sói cắn mà không được cứu sẽ biến thành Sói.'],
 scapegoat:['Kẻ thế mạng','🪢','dân','Bị loại thay khi kết quả biểu quyết hòa.'],
 cupid:['Thần tình yêu','💘','dân','Đêm đầu ghép hai người. Một người chết thì người kia chết theo. Khác phe thì cặp đôi thắng khi là hai người cuối.'],
 tanner:['Kẻ chán đời','🃏','riêng','Thắng một mình nếu bị biểu quyết loại.'],
 wildchild:['Đứa trẻ hoang dã','🌱','dân','Đêm đầu chọn thần tượng. Thần tượng chết thì hóa Sói.'],
 minion:['Tay sai','🦊','sói','Biết bầy Sói, nhưng Sói không biết bạn. Tiên tri soi ra Dân.'],
 wolfcub:['Sói con','🐺','sói','Đi cùng bầy; khi chết, đêm sau bầy được chọn hai nạn nhân.'],
 wolffather:['Sói nguyền','🐺','sói','Một lần trong ván, biến nạn nhân đầu của bầy thành Sói thay vì giết.'],
 whitewolf:['Sói trắng','🐺','riêng','Đi cùng bầy; đêm chẵn giết thêm một Sói. Thắng khi là Sói cuối và còn tối đa một người khác.'],
 serial:['Sát nhân','🗡️','riêng','Mỗi đêm giết một người. Miễn nhiễm đòn cắn của Sói. Thắng khi còn tối đa hai người.'],
 piper:['Kẻ thổi sáo','🪈','riêng','Mỗi đêm mê hoặc tối đa hai người. Thắng khi mọi người còn sống khác đều bị mê hoặc.']
};
export const WW_WOLVES=new Set(['wolf','wolfcub','wolffather','whitewolf']);
export const WW_STEPS={cupid:'Ghép đôi',wildchild:'Chọn thần tượng',guard:'Bảo vệ',wolves:'Bầy Sói',whitewolf:'Sói trắng',serial:'Sát nhân',witch:'Phù thủy',seer:'Tiên tri',detective:'Thám tử',raven:'Quạ',oldhag:'Bà già',piper:'Kẻ thổi sáo'};
export const WW_DEFAULTS={discussion:180,night:45,action:20,vote:45,reveal:true,roles:['seer','guard']};
export function wolfSeat(index,count){const angle=index*2*Math.PI/Math.max(1,count);return {x:30+Math.sin(angle)*6,z:Math.cos(angle)*6,yaw:angle};}
