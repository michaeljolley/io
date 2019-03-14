namespace B3Bot.UI.Models
{
    public class CountModel
    {
        public CountModel(int value, int? refreshInMilliseconds)
        {
            Value = value;
            RefreshMilliseconds = refreshInMilliseconds.GetValueOrDefault(0);
        }

        public int Value { get; set; }

        public int RefreshMilliseconds { get; set; }
    }
}
